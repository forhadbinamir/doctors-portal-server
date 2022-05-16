const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000
require('dotenv').config()

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4ibwc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await client.connect()
    try {
        const databaseCollection = client.db("doctor_portal").collection("service");
        const bookingCollection = client.db("doctor_portal").collection("booking");
        const userCollection = client.db("doctor_portal").collection("users");

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ success: true, result })
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date
            //step: 1 to get all array
            const services = await databaseCollection.find().toArray()
            //step: 2 get the booking of that day
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray()
            //step: 3 for each service,

            services.forEach(service => {
                //step: find booking for that service
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                //step: 5 select slots for the service booking 
                const bookedSlots = serviceBookings.map(book => book.slot)
                // console.log(bookedSlots)
                //step: 6 select those slot that are not in book slot
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))

                //step: set available to slots make it easier    
                service.slots = available

            })
            res.send(services)
        })

        app.get('/booking', async (req, res) => {
            const patient = req.query.patient
            const query = { patient: patient }
            const bookings = await bookingCollection.find(query).toArray()
            res.send(bookings)
        })

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = databaseCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })
    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Doctors portal server is running !')
})

app.listen(port, () => {
    console.log(`Doctors portal port is running ${port}`)
})