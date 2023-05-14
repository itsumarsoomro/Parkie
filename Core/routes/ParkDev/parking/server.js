  require("dotenv").config()

  const express = require('express');
  const { MongoClient, ObjectId } = require('mongodb');
  const { readFile } = require('fs/promises');
  const sgMail = require('@sendgrid/mail')

  const app = express();
  const port = 3000;
  const uri = "mongodb+srv://No3Mc:DJ2vCcF7llVDO2Ly@cluster0.cxtyi36.mongodb.net/Parking?retryWrites=true&w=majority";

  // middle ware
  app.use(express.static('public'));
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }));

  // stripe api key
  const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY)

  async function connectToDatabase(uri) {
    const client = await MongoClient.connect(uri, { useNewUrlParser: true });
    const markersCollection = client.db("Parking").collection("marker");
    console.log("Connected to MongoDB Atlas");

    return markersCollection.find().toArray();
  }

  async function start() {
    const markersWithStatus = await connectToDatabase(uri);

    app.get('/markers', (req, res) => {
      res.json(markersWithStatus);
    });
  }

  // testing data
  const parkSlots =  new Map ([
    [1, {priceInCents: 100, name: "Parking slot"}]
  ])

  // stripe checkout
  app.post('/create-checkout-session', async (req, res) => {
    const { name, email, markerId } = req.body;
    try{
      const client = await MongoClient.connect(uri, { useNewUrlParser: true });
      const markersCollection = client.db("Parking").collection("marker");
      const marker = await markersCollection.findOne({ _id: new ObjectId(markerId) });
            
      if (marker.status === "available") { 
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: req.body.items.map(item =>{
            const parkSlot = parkSlots.get(item.id)
            return{
              price_data: {
                currency: 'gbp',
                product_data: {
                  name: parkSlot.name,
                },
                unit_amount: parkSlot.priceInCents,
              },
              quantity: item.quantity,
            }
          }),     
          success_url: `${process.env.SERVER_URL}/book?name=${name}&email=${email}&markerId=${markerId}`,
          cancel_url: `${process.env.SERVER_URL}/cancel.html`,
          metadata: {
            success_message: "Payment successful!",
          },
        });
        res.json({ url: session.url});
      } 
      else {
        // Marker is already booked, send an error message to the user
        res.status(409).json({ message: "Marker is already booked ⚠️" });
      }
    }
    catch (err) {
      console.error(err);
      res.status(500).json({ message: "We are facing unexpected error ⚠️" + err.message });
    }
  });
  
  // booking 
  app.get('/book', async (req, res) => {
    const { name, email, markerId } = req.query;
    
    try {
      const client = await MongoClient.connect(uri, { useNewUrlParser: true });
      const markersCollection = client.db("Parking").collection("marker");
    
      const marker = await markersCollection.findOne({ _id: new ObjectId(markerId) });
    
      if (marker.status === "available") {
        const updatedMarker = await markersCollection.findOneAndUpdate(
          { _id: new ObjectId(markerId) },
          { $set: { name, email, status: 'booked' } },
          { returnOriginal: false }
        );
        
        console.log(`Marker ${markerId} has been booked by ${name} (${email})`);
  
        const msg = {
          to: email,
          from: { name: 'Parkie', email: 'parkie.parking@gmail.com' },
          templateId: 'd-ec1c780d10334a3386396ea75f9fc332',
          dynamicTemplateData: {
            name: name,
            markerId: markerId,
            email: email
          }
        };
  
        sgMail.setApiKey(process.env.SG_PRIVATE_KEY);
        await sgMail.send(msg);
        
        // // Update the marker object with the new status
        // marker.status = 'booked';

        // // Send the updated marker object as the response
        //  res.json({ marker: marker });

        res.redirect(`${process.env.SERVER_URL}?success=true`);
      } else {
        // Marker is already booked, send an error message to the user
        res.status(409).send(`Marker ${markerId} is already booked ⚠️`);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send(`We are facing unexpected error ⚠️ ${err.message}`);
    }
  });
  
  // getting the parking data
  app.get('/history', (req, res) => {
    res.sendFile(__dirname + '/history.html');
  });
  
  app.get('/history/data', async (req, res) => {
    try {
      const client = await MongoClient.connect(uri, { useNewUrlParser: true });
      const markersCollection = client.db("Parking").collection("marker");
      const history = await markersCollection.find({ status: 'booked' }).toArray();
      res.json(history);
    } catch (err) {
      console.error(err);
      res.status(500).send(`We are facing unexpected error ⚠️ ${err.message}`);
    }
  });

  // deleting the data
  app.delete('/history/data/:id', async (req, res) => {
    try {
      const client = await MongoClient.connect(uri, { useNewUrlParser: true });
      const markersCollection = client.db("Parking").collection("marker");
      const markerId = req.params.id;
  
      const marker = await markersCollection.findOne({ _id: new ObjectId(markerId) });
  
      if (!marker) {
        res.status(404).json({ message: "Marker not found ⚠️" });
        return;
      }
  
      if (marker.status !== 'booked') {
        res.status(409).json({ message: "Cannot delete. Marker is not booked ⚠️" });
        return;
      }
  
      const { name, email } = marker;
  
      await markersCollection.updateOne(
        { _id: new ObjectId(markerId) },
        {
          $set: {
            status: 'available',
            name: '',
            email: ''
          }
        }
      );
  
      // Send cancellation email using SendGrid
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SG_PRIVATE_KEY);
  
      const msg = {
        to: email,
        from: { name: 'Parkie', email: 'parkie.parking@gmail.com' },
        templateId: 'd-cc5e9e9251c54a2ab54f8451eb0beb5c',
        dynamicTemplateData: {
          name: name,
          markerId: markerId,
          email: email
        }
      };
  
      await sgMail.send(msg);
  
      res.sendStatus(204);
    } catch (err) {
      console.error(err);
      res.status(500).send(`We are facing unexpected error ⚠️ ${err.message}`);
    }
  });
  
  
  
  
  
  app.listen(port, () => {
      console.log(`App listening at http://localhost:${port}`);
  });


start();






      




