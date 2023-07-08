const express = require("express");
const cors = require("cors");
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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const usersCollection = client.db("shop-ex").collection("users");
    //APIs are started here
    // store user data to db
    app.post("/store-user", async (req, res) => {
      const { name, profilePic, profileDelete, email } = req.body;
      const userInfo = {
        name,
        profilePic,
        profileDelete,
        email,
        openingData: new Date(),
        role: "user",
      };
      // APIs are ends here
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });
    // send jwt
    app.get("/jwt", (req, res) => {
      const data = { email: req.query.email };
      console.log(data);
      const token = jwt.sign(data, process.env.TOKEN_SECRET, {
        expiresIn: "12h",
      });
      console.log(token);
      res.send({ token });
    });
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
run().catch(console.dir);
