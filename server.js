const express = require('express')
const mongoose = require('mongoose');
const { request } = require('node:http');

const app = express()
const port = 5000

const Schema = mongoose.Schema;
    var possibleTypes = []
    var pokeSchema = new Schema ({
        "base": {
            "HP": Number,
            "Attack": Number,
            "Defense": Number,
            "Speed": Number,
            "Sp. Attack": Number,
            "Sp. Defense": Number,
        },
        "id": Number,
        "name": {
            "english": String,
            "japanese": String,
            "chinese": String,
            "french": String
        },
        "type": [
            String, 
            String
        ],
        "__v": Number
    })

    const pokeModel = mongoose.model('Pokemon', pokeSchema);

    
app.listen(process.env.PORT || port, async () => {
    try {
        await mongoose.connect('mongodb+srv://user1:VRJk55Ky8glhQoQe@cluster0.eg3xtej.mongodb.net/Pokemon?retryWrites=true&w=majority')
        mongoose.connection.db.dropDatabase();
    } catch (error) {
        console.log('db error')
    }
    console.log(`Server running on port ${port}`)

    var https = require('node:https');
    //grab the types
    await https.get("https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/types.json", async (res) => {
        let data = "";
        res.on("data", (chunk) => {
            data += chunk;
        });
        res.on("end", async () => {
            possibleTypes = JSON.parse(data);
        }); 
    })

    //grab the pokemon
    https.get("https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json", function(res) {
        var chunks = "";
        res.on("data", function(chunk) {
            chunks += chunk;
        });
        res.on("end", function(data) {
            const arr = JSON.parse(chunks);
            arr.map(element => {
                mongoose.connection.db.collection('pokemons').insertOne(element);
            })
        })
    })

})

app.get('/api/v1/pokemon/:id', (req, res) => {
    if(isNaN(req.params.id)){
        res.json({errmsg: "CastError: Check your input"})
    } else {
    pokeModel.find({ id: req.params.id }, function(err, data) {
        if (err) {
            res.json({errmsg: "Pokemon not found"})
        } 
        else if (data.length <= 0) {
            res.json({errmsg: "Pokemon not found"})
        } 
        else {
            res.send(data)
        }
    })
    }
})

// - get all the pokemons after the 10th. List only Two.
app.get('/api/v1/pokemons', (req, res) => {
    pokeModel.find({"id":{$gt:req.query.after}}, null, {limit:req.query.count}, function(err, data) {
        if (err) {
            res.json({errmsg: "invalid count or after"});
        } else {
            res.send(data);
        }
    });
});

// - create a new pokemon    
app.use(express.json());
app.post('/api/v1/pokemon', async (req, res) => {
    var count = await pokeModel.countDocuments({id:req.params.id})
    pokeModel.create(req.body, function(err, data) {
        if(err) {
            res.json({errmsg: "invalid pokemon"});
        } else if(req.body.name.english.length > 25) {
            res.json({errmsg: "ValidationError: check your name length."});
        } else if(count == 1) { // can't find id in db
            res.json({errmsg: "ValidationError: check your id."});
        }
        else {
            res.send({msg: "Added Successfully"});
            console.log(data);
        }
 })                       
})

// - delete a pokemon
app.delete('/api/v1/pokemon/:id', (req, res) => {
    pokeModel.findOneAndDelete({id: req.params.id}, function(err, result) {
        if(!result) {
            res.json({errmsg: "Pokemon not found"});
        } else {
            console.log(result);
            res.send("Deleted Successfully"); 
        }
    })
})

// - upsert a whole pokemon document
app.put('/api/v1/pokemon/:id', (req, res) => {
    pokeModel.findOneAndUpdate({id: req.params.id}, req.body, function(err, result) {
        if(err) {
            res.json({errmsg: "Pokemon not found"});
        } else if (!result){
            console.log(result);
            res.send("Updated Successfully");
        } else {
        }
    })
})

// - patch a pokemon document or a portion of the pokemon document
app.patch('/api/v1/pokemon/:id', (req, res) => {
    pokeModel.findOneandUpdateOne({id: req.params.id}, req.body, function(err, result) {
        if(err) {
            res.json({errmsg: "Pokemon not found"});
        } else {
            console.log(result);
            res.send("Updated Successfully");
        }
    })
})

// - get a pokemon Image URL
app.get('/api/v1/pokemonImage/:id', (req, res) => {
    res.send(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${req.params.id}.png`)
})

app.get('*', function(req, res){
    res.status(404).json({errMsg: 'Improper route'});
});
    