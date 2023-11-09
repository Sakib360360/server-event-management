require("dotenv").config();
const express = require("express");
const cors = require("cors");
const SSLCommerzPayment = require("sslcommerz-lts");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vahgs6d.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//sssl commerze
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; //true for live, false for sandbox

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const eventsCollection = client.db("EventsDB").collection("events");
    const usersCollection = client.db("EventsDB").collection("users");
    const paymentsCollection = client.db("EventsDB").collection("payments");

    // get all the events based on user's email
    app.get("/events", async (req, res) => {
      // const email = req.query.email;
      const query = {};
      const result = await eventsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/events/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await eventsCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.status(404).send("Event not found");
      }
    });

    // save the event into the database
    app.post("/events", async (req, res) => {
      const event = req.body;
      const result = await eventsCollection.insertOne(event);
      res.send(result);
    });

    // update a event in database
    app.patch("/events/:id", async (req, res) => {
      const id = req.params.id;
      const event = req.body;

      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          name: event.name,
          description: event.description,
          image: event.image,
          date: event.date,
          time: event.time,
          location: event.location,
          category: event.category,
          tickets: event.tickets,
        },
      };

      const result = await eventsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // delete from the database
    app.delete("/events/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await eventsCollection.deleteOne(query);
      res.send(result);
    });

    // favorite events api here
    // save user into the database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const userExists = await usersCollection.findOne(query);

      if (userExists) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // get all the users from database
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // tranx_id
    const tranx_id = new ObjectId().toString();
    //payment api
    app.post("/order", async (req, res) => {
      const event = await eventsCollection.findOne({
        _id: new ObjectId(req.body.eventId),
      });

      const order = req.body;
      const price = parseFloat(event.ticketPrice);
      console.log(price);
      const data = {
        total_amount: price,
        currency: order.currency,
        tran_id: tranx_id, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payments/success/${tranx_id}`,
        fail_url: `http://localhost:5000/payments/fail/${tranx_id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: event.eventName,
        product_category: "Tickets",
        product_profile: "general",
        cus_name: order.name,
        cus_email: order.email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: order.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      //console.log(data)
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        const finalPayment = {
          event,
          paidStatus: false,
          tranjectionId: tranx_id,
          user: order.email
        };
        const result = paymentsCollection.insertOne(finalPayment);
        console.log("Redirecting to: ", GatewayPageURL);
      });
      app.post("/payments/success/:trx_Id", async (req, res) => {
        console.log(req.params.trx_Id);
        const result = await paymentsCollection.updateOne(
          { tranjectionId: req.params.trx_Id },
          {
            $set: {
              paidStatus: true,
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:3000/dashboard/payments/success/${req.params.trx_Id}`
          );
        }
      });
      app.post("/payments/fail/:trx_Id", async (req, res) => {
         const result = await paymentsCollection.deleteOne({ tranjectionId: req.params.trx_Id })
         if(result.deletedCount){
          res.redirect(
            `http://localhost:3000/dashboard/payments/fail/${req.params.trx_Id}`
          );
         }
      })
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

app.get("/", (req, res) => {
  res.send("server running in localhost");
});

app.listen(port, () => {
  console.log(`visit http://localhost:${port}`);
});
