const express = require('express')
const cors = require('cors');
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