const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send([`Server is running at port ${port}`]);
});

app.listen(port, () => {
  console.log(`Server is started at port ${port}`);
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.9.1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized user." });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "Access denied" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const usersCollection = client.db("shop-ex").collection("users");
    const productsCollection = client.db("shop-ex").collection("products");
    //user verification
    const verifySeller = async (req, res, next) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const query = { email: decodedEmail };
      const result = await usersCollection.findOne(query, {
        projection: { _id: 0, role: 1, sellerRequest: 1 },
      });
      if (result.role !== "seller" || result.sellerRequest !== "approved") {
        return res.status(403).send({ error: true, message: "Access denied" });
      } else {
        next();
      }
    };
    //APIs are started here

    // store user data to db
    app.post("/store-user", async (req, res) => {
      const { name, profilePic, profileDelete, email } = req.body;
      const query = { email };
      const isAlreadyAUser = await usersCollection.findOne(query);
      if (isAlreadyAUser) {
        return res.send(["Ok"]);
      }
      const userInfo = {
        name,
        profilePic,
        profileDelete,
        email,
        openingData: new Date(),
        role: "customer",
      };
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
    //delete user
    app.delete("/delete-user", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const options = {
        projection: { _id: 0, role: 1 },
      };
      const { role } = await usersCollection.findOne(
        { email: decodedEmail },
        options
      );
      if (role === "customer") {
        const result = await usersCollection.deleteOne({ email });
        res.send(result);
      } else {
        return res.send({
          error: true,
          message: `Cannot delete ${role} Account.`,
        });
      }
    });
    // send jwt
    app.get("/jwt", (req, res) => {
      const data = { email: req.query.email };
      const token = jwt.sign(data, process.env.TOKEN_SECRET, {
        expiresIn: "12h",
      });
      res.send({ token });
    });
    //get role
    app.get("/role", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const options = {
        projection: { _id: 0, role: 1 },
      };
      const result = await usersCollection.findOne(query, options);
      res.send(result);
    });
    //Update user Photo
    app.post("/update-user-profile-pic", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const query = { email: decodedEmail };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          profilePic: req.body.profilePic,
          profileDelete: req.body.profileDelete,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });
    //application for seller
    app.post("/become-a-seller", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const query = { email: decodedEmail };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          sellerRequest: "pending",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, option);
      res.send(result);
    });
    //application status
    app.get("/seller-application-status", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const result = await usersCollection.findOne(
        { email: decodedEmail },
        { projection: { _id: 0, sellerRequest: 1, deniedReason: 1 } }
      );
      if (!result.sellerRequest) {
        return res.send({ sellerRequest: null });
      }
      res.send(result);
    });
    // get unique categories
    app.get("/get-categories", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const pipeline = [
        {
          $group: {
            _id: null,
            categories: { $addToSet: "$product_info.category" },
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ];
      const result = await productsCollection.aggregate(pipeline).toArray();
      const category = [];
      for (const item of result[0].categories) {
        const newItem = { value: item, label: item };
        category.push(newItem);
      }
      const pipeline2 = [
        {
          $group: {
            _id: null,
            categories: { $addToSet: "$product_info.sub_category" },
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ];
      const result2 = await productsCollection.aggregate(pipeline2).toArray();
      const subCategories = [];
      for (const item of result2[0].categories) {
        const newItem = { value: item, label: item };
        subCategories.push(newItem);
      }
      res.send({ category, sub_categories: subCategories });
    });

    //======================seller api starts here=====================
    app.get("/seller-product-info-count", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const query = { "seller_info.email": decodedEmail };
      const totalAdded = await productsCollection
        .find(query, { projection: { _id: 0, status: 1 } })
        .toArray();
      const totalApproved = totalAdded.filter(
        item => item.status === "approved"
      ).length;
      const totalPending = totalAdded.filter(
        item => item.status === "pending"
      ).length;
      const totalRejected = totalAdded.filter(
        item => item.status === "rejected"
      ).length;
      res.send({
        totalAdded: totalAdded.length,
        totalPending,
        totalApproved,
        totalRejected,
      });
    });
    //add new product
    app.post("/add-new-product", verifyJWT, verifySeller, async (req, res) => {
      const body = req.body;
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      const productInfo = {
        product_info: {
          name: body.product_name,
          available_status: "in-stock",
          images: [body.image_links],
          productDetails: body.product_description,
          sizes: body.sizes,
          ratings: body.ratings,
          created_date: new Date(),
          last_update: new Date(),
          available_quantity: body.available_quantity,
          category: body.category,
          sub_category: body.sub_category,
          seller_price: body.product_price,
          price: parseFloat(
            (body.product_price * 0.1 + body.product_price).toFixed(2)
          ),
        },
        seller_info: {
          name: body.seller_name,
          email: decodedEmail,
        },
        total_sold: 0,
        comments: [],
        status: "pending",
      };
      const result = await productsCollection.insertOne(productInfo);
      res.send(result);
    });
    //added products
    app.get("/my-added-products", async (req, res) => {
      const email = req.query.email;
      // const decodedEmail = req.decoded.email;
      // if (email !== decodedEmail) {
      //   return res.status(403).send({ error: true, message: "Access denied" });
      // }
      const query = { "seller_info.email": email };
      const option = {
        projection: {
          _id: 1,
          "product_info.name": 1,
          "product_info.images": 1,
          "product_info.productDetails": 1,
          "product_info.sizes": 1,
          "product_info.available_quantity": 1,
          "product_info.seller_price": 1,
        },
      };
      const result = await productsCollection.find(query, option).toArray();
      res.send(result);
    });
    //========================seller api ends here=====================

    // APIs are ends here
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
function extractDeleteHash(imageUrl) {
  const urlParts = imageUrl.split("/");
  const deleteHash = urlParts[urlParts.length - 1].split(".")[0];
  return deleteHash;
}
run().catch(console.dir);
