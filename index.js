require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000

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
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const eventsCollection = client.db("EventsDB").collection("events");
    const usersCollection = client.db("EventsDB").collection("users");

    // get all the events based on user's email
    app.get("/events", async(req, res)=>{
        // const email = req.query.email;
        const query = {};
        const result = await eventsCollection.find(query).toArray();
        res.send(result);
    });

    app.get("/events/:id", async(req, res)=>{
      const id = req.params.id;
    const query = { _id: new ObjectId(id)} 
   
      const result = await eventsCollection.findOne(query);
      if (result) {
        console.log(result);
        res.send(result);
      } else {
        res.status(404).send('Event not found');
      }
  });


    // save the event into the database
    app.post("/events", async(req, res)=>{
        const event = req.body;
        const result = await eventsCollection.insertOne(event);
        res.send(result);
    });

    // update a event in database
    app.patch("/events/:id", async(req, res)=>{
        const id = req.params.id;
        const event = req.body;

        const query = {_id: new ObjectId(id)};
        
        const updateDoc = {
            $set: {
                name: event.name,
                description: event.description,
                image: event.image,
                date: event.date,
                time: event.time,
                location: event.location,
                category: event.category,
                tickets: event.tickets
            }
        }

        const result = await eventsCollection.updateOne(query, updateDoc);
        res.send(result);
    });


    // delete from the database
    app.delete("/events/:id", async(req, res)=>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
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

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
 /*    //payment api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const insertResult = await paymentCollection.insertOne(payment);    
      const query = { _id: new ObjectId(payment.classId) };
      console.log(query);
      //class and my class different
      const queryClass = { classId: payment.classId };
      const deleteResult = await myClassCollection.deleteOne(queryClass)
      ;
     const classinfo = await classCollection.findOne(query);
     const newSeat = parseFloat(classinfo?.availableSeats) - 1;
     const newStudents = parseFloat(classinfo?.students) +1;
     const updateSeat = {
                   $set:{ availableSeats: newSeat, 
                          students: newStudents
                  }

                   
     }
     const updateClassSeat = await classCollection.updateOne(query, updateSeat);
      res.send({ insertResult, deleteResult });
    }); */
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res)=>{
    res.send("server running in localhost");
});

app.listen(port, ()=>{
    console.log(`visit http://localhost:${port}`);
})