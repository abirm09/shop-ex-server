const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const Joi = require("joi");
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
// const uri = `mongodb+srv://${process.env.DB_ID}:${process.env.DB_PASS}@cluster0.v6yry4e.mongodb.net/?retryWrites=true&w=majority`;
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
      const email = req?.query?.email;
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
    //product verification
    const verifyProductOwner = async (req, res, next) => {
      const reqId = req?.query?.id;
      const decodedEmail = req.decoded.email;
      const query = { _id: new ObjectId(reqId) };
      const productOwnerEmail = await productsCollection.findOne(query, {
        projection: { _id: 0, "seller_info.email": 1 },
      });
      if (productOwnerEmail.seller_info.email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      } else {
        next();
      }
    };
    //user verification
    const verifyUser = (req, res, next) => {
      const email = req?.query?.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access denied" });
      } else {
        next();
      }
    };
    //staff verification
    const verifyStaff = async (req, res, next) => {
      const email = req?.query?.email;
      const result = await usersCollection.findOne(
        { email },
        { projection: { _id: 0, role: 1 } }
      );
      if (result?.role !== "staff") {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      next();
    };

    //admin verification
    const verifyAdmin = async (req, res, next) => {
      const email = req?.query?.email;
      const result = await usersCollection.findOne(
        { email },
        { projection: { _id: 0, role: 1 } }
      );
      if (result?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
      next();
    };
    //validate id
    const validateId = (req, res, next) => {
      const id = req.query.id;
      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ error: true, message: "Wrong product id" });
      }
      next();
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
    app.delete("/delete-user", verifyJWT, verifyUser, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
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
    app.post(
      "/update-user-profile-pic",
      verifyJWT,
      verifyUser,
      async (req, res) => {
        const email = req.query.email;
        const decodedEmail = req.decoded.email;
        const query = { email: decodedEmail };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            profilePic: req.body.profilePic,
            profileDelete: req.body.profileDelete,
          },
        };
        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );
        res.send(result);
      }
    );
    //application for seller
    app.post("/become-a-seller", verifyJWT, verifyUser, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
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
    app.get(
      "/seller-application-status",
      verifyJWT,
      verifyUser,
      async (req, res) => {
        const email = req.query.email;
        const decodedEmail = req.decoded.email;
        const result = await usersCollection.findOne(
          { email: decodedEmail },
          { projection: { _id: 0, sellerRequest: 1, deniedReason: 1 } }
        );
        if (!result.sellerRequest) {
          return res.send({ sellerRequest: null });
        }
        res.send(result);
      }
    );
    // get unique categories
    app.get("/get-categories", verifyJWT, verifyUser, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
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

    //======================Public api starts here=====================
    //get single products info
    app.get("/single-product", validateId, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const option = {
        projection: {
          "product_info.name": 1,
          "product_info.images": 1,
          "product_info.productDetails": 1,
          "product_info.sizes": 1,
          "product_info.ratings": 1,
          "product_info.available_quantity": 1,
          "product_info.price": 1,
          "seller_info.name": 1,
          "seller_info.email": 1,
        },
      };
      const result = await productsCollection.findOne(query, option);
      res.send({ result });
    });
    //get all active products
    app.get("/products", async (req, res) => {
      const query = { status: "approved" };
      const option = {
        projection: {
          "product_info.name": 1,
          "product_info.images": 1,
          "product_info.images": 1,
          "product_info.sizes": 1,
          "product_info.ratings": 1,
          "product_info.created_date": 1,
          "product_info.available_quantity": 1,
          "product_info.category": 1,
          "product_info.sub_category": 1,
          "product_info.price": 1,
          seller_info: 1,
          comments: 1,
        },
      };
      const result = await productsCollection.find(query, option).toArray();
      res.send(result);
    });

    //get random products
    app.get("/random-products/:limit", async (req, res) => {
      const limit = req.params.limit || 20;
      const pipeline = [
        { $match: { status: "approved" } },
        { $sample: { size: Number(limit) } },
        {
          $project: {
            "product_info.name": 1,
            "product_info.images": 1,
            "product_info.images": 1,
            "product_info.sizes": 1,
            "product_info.ratings": 1,
            "product_info.created_date": 1,
            "product_info.available_quantity": 1,
            "product_info.category": 1,
            "product_info.sub_category": 1,
            "product_info.price": 1,
            seller_info: 1,
            comments: 1,
          },
        },
      ];
      const result = await productsCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    //======================Public api ends here=====================
    //======================seller api starts here=====================
    app.get(
      "/seller-product-info-count",
      verifyJWT,
      verifyUser,
      async (req, res) => {
        const decodedEmail = req.decoded.email;
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
          item => item.status === "rejected" || item.status === "adminRejected"
        ).length;
        res.send({
          totalAdded: totalAdded.length,
          totalPending,
          totalApproved,
          totalRejected,
        });
      }
    );
    //add new product
    app.post(
      "/add-new-product",
      verifyJWT,
      verifyUser,
      verifySeller,
      async (req, res) => {
        const body = req.body;
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
      }
    );
    //added products
    app.get(
      "/my-added-products",
      verifyJWT,
      verifyUser,
      verifySeller,
      async (req, res) => {
        const decodedEmail = req.decoded.email;
        const query = { "seller_info.email": decodedEmail };
        const option = {
          projection: {
            _id: 1,
            "product_info.name": 1,
            "product_info.images": 1,
            "product_info.productDetails": 1,
            "product_info.sizes": 1,
            "product_info.available_quantity": 1,
            "product_info.seller_price": 1,
            status: 1,
          },
        };
        const result = await productsCollection.find(query, option).toArray();
        res.send(result);
      }
    );
    app.delete(
      "/delete-product",
      verifyJWT,
      verifyUser,
      verifySeller,
      verifyProductOwner,
      async (req, res) => {
        const reqId = req.query.id;
        const query = { _id: new ObjectId(reqId) };
        const result = await productsCollection.deleteOne(query);
        res.send(result);
      }
    );
    app.get(
      "/single-product-info",
      verifyJWT,
      verifySeller,
      verifyProductOwner,
      verifyUser,
      async (req, res) => {
        const reqId = req.query.id;
        const query = { _id: new ObjectId(reqId) };
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
        const result = await productsCollection.findOne(query, option);
        res.send(result);
      }
    );
    //update product
    app.put(
      "/update-product",
      verifyJWT,
      verifySeller,
      verifyProductOwner,
      verifyUser,
      async (req, res) => {
        const body = req.body;
        console.log(body);
        res.send(["ok"]);
      }
    );
    app.get(
      "/sellers-rejected-products",
      verifyJWT,
      verifyUser,
      verifySeller,
      async (req, res) => {
        const decodedEmail = req.decoded.email;
        const query = {
          "seller_info.email": decodedEmail,
          $or: [{ status: "rejected" }, { status: "adminRejected" }],
        };
        const option = {
          projection: {
            "product_info.name": 1,
            "product_info.images": 1,
            rejected_by: 1,
            rejected_reason: 1,
            admin_rejected_reason: 1,
            rejected_admin: 1,
            status: 1,
          },
        };
        const result = await productsCollection.find(query, option).toArray();
        res.send(result);
      }
    );
    app.post(
      "/correction-done",
      verifyJWT,
      verifyUser,
      validateId,
      verifySeller,
      verifyProductOwner,
      async (req, res) => {
        const id = req.query.id;
        const query = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const ifStaffReject = {
          rejected_by: 1,
          rejected_reason: 1,
        };
        const ifAdminReject = {
          admin_rejected_reason: 1,
          rejected_admin: 1,
        };
        const updateDoc = {
          $set: {
            status: req.query.status === "rejected" ? "pending" : "checked",
          },
          $unset:
            req.query.status === "rejected" ? ifStaffReject : ifAdminReject,
        };
        const result = await productsCollection.updateOne(
          query,
          updateDoc,
          option
        );
        res.send(result);
      }
    );
    //========================seller api ends here=====================
    //========================staff api starts here=====================
    app.get(
      "/staff-info-count",
      verifyJWT,
      verifyUser,
      verifyStaff,
      async (req, res) => {
        const option = { projection: { _id: 0, status: 1 } };
        const result = await productsCollection.find({}, option).toArray();
        const pending_products = result.filter(
          item => item.status === "pending"
        ).length;
        const approved_products = result.filter(
          item => item.status === "approved"
        ).length;
        const rejected_products = result.filter(
          item => item.status === "rejected"
        ).length;
        res.send({
          totalProducts: result.length,
          pending_products: pending_products,
          approved_products,
          rejected_products,
        });
      }
    );
    //get al pending products
    app.get(
      "/pending-products",
      verifyJWT,
      verifyUser,
      verifyStaff,
      async (req, res) => {
        const query = { status: "pending" };
        const option = {
          projection: {
            "product_info.name": 1,
            "product_info.images": 1,
            "seller_info.email": 1,
          },
        };
        const result = await productsCollection.find(query, option).toArray();
        res.send(result);
      }
    );
    //initial check product
    app.put(
      "/initial-check-product",
      verifyJWT,
      verifyUser,
      verifyStaff,
      validateId,
      async (req, res) => {
        const id = req.query.id;
        const email = req.query.email;
        const staffName = req.query.name;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "checked",
            checkedBy: {
              staffName,
              staffEmail: email,
            },
          },
          $unset: {
            rejected_by: 1,
            rejected_reason: 1,
          },
        };
        const result = await productsCollection.updateOne(query, updateDoc, {
          upsert: true,
        });
        res.send(result);
      }
    );
    //initial reject product
    app.put(
      "/reject-initial",
      verifyJWT,
      verifyUser,
      verifyStaff,
      validateId,
      async (req, res) => {
        const id = req.query.id;
        const { reason } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "rejected",
            rejected_reason: reason,
            rejected_by: {
              staffName: req.query.name,
              staffEmail: req.query.email,
            },
          },
        };
        const option = { upsert: true };
        const result = await productsCollection.updateOne(
          query,
          updateDoc,
          option
        );
        res.send(result);
      }
    );
    //========================staff api ends here=====================
    //========================admin api starts here=====================

    //get admin info count
    app.get(
      "/admin-info-count",
      verifyJWT,
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const result = await productsCollection
          .find({}, { projection: { _id: 0, status: 1 } })
          .toArray();
        const pendingApproval = result.filter(
          item => item.status === "checked"
        ).length;
        const approveProducts = result.filter(
          item => item.status === "approved"
        ).length;
        const rejectedProducts = result.filter(
          item => item.status === "adminRejected"
        ).length;
        const infoCount = {
          totalProducts: result.length,
          pendingApproval,
          approveProducts,
          rejectedProducts,
        };
        res.send(infoCount);
      }
    );

    //initial checked products
    app.get(
      "/checked-products",
      verifyJWT,
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const query = { status: "checked" };
        const result = await productsCollection.find(query).toArray();
        res.send(result);
      }
    );
    //admin approve
    app.post("/approve-by-admin", async (req, res) => {
      const adminEmail = req.query.email;
      const adminName = req.query.displayName;
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
          approved_by: {
            adminName,
            adminEmail,
          },
        },
        $unset: {
          admin_rejected_reason: 1,
          rejected_admin: 1,
        },
      };
      const result = await productsCollection.updateOne(query, updateDoc, {
        upsert: true,
      });
      res.send(result);
    });
    app.post(
      "/rejected-by-admin",
      verifyJWT,
      verifyUser,
      validateId,
      verifyAdmin,
      async (req, res) => {
        const id = req.query.id;
        const { reason } = req.body;
        const rejectedAdmin = {
          adminName: req.query.name,
          adminEmail: req.query.email,
        };
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "adminRejected",
            admin_rejected_reason: reason,
            rejected_admin: rejectedAdmin,
          },
        };
        const result = await productsCollection.updateOne(query, updateDoc, {
          upsert: true,
        });

        res.send(result);
      }
    );
    //get all requested seller
    app.get(
      "/requested-seller",
      verifyJWT,
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const query = { sellerRequest: "pending" };
        const option = {
          projection: {
            name: 1,
            profilePic: 1,
            email: 1,
            openingData: 1,
          },
        };
        const result = await usersCollection.find(query, option).toArray();
        res.send(result);
      }
    );
    //approve seller request
    app.post(
      "/approve-seller-request",
      verifyJWT,
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const reqEmail = req.query.reqEmail;
        const query = { email: reqEmail };
        const adminEmail = req.query.email;
        const updateDoc = {
          $set: {
            sellerRequest: "approved",
            role: "seller",
            approvedBY: adminEmail,
          },
        };
        const result = await usersCollection.updateOne(query, updateDoc, {
          upsert: true,
        });
        res.send(result);
      }
    );
    //get user info for adding new staff
    app.get(
      "/get-new-staff-info",
      verifyJWT,
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const { staffEmail } = req.query;
        const query = { email: staffEmail, role: "customer" };
        const result = await usersCollection.findOne(query);
        if (!result) {
          return res.send({
            status: false,
            message: "Could not find any customer to this email.",
          });
        }
        result.status = true;
        res.send(result);
      }
    );
    //approve new staff
    app.post(
      "/make-new-staff",
      verifyJWT,
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const { email, staffEmail } = req.query;
        const query = { email: staffEmail };
        const updateDoc = {
          $set: {
            role: "staff",
            approved_by: email,
          },
        };
        const result = await usersCollection.updateOne(query, updateDoc, {
          upsert: true,
        });
        res.send(result);
      }
    );
    //========================admin api ends here=====================

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
