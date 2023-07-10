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
