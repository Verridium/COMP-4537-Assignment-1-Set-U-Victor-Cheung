const express = require('express')
const mongoose = require('mongoose');
const {connectDB} = require("./connectDB.js")
const {populatePokemons} = require("./populatePokemons.js")
const {getTypes} = require("./getTypes.js")
const {handleErr} = require("./errorHandler.js")

const {
    PokemonBadRequest,
    PokemonNotFoundError,
    PokemonDbError,
    PokemonDuplicateError,
    PokemonBadRequestMissingID,
    PokemonBadRequestMissingAfter,
    PokemonNoSuchRouteError
} = require('./error.js');

const { asyncWrapper } = require('./asyncWrapper.js');

const dotenv = require("dotenv")
dotenv.config();

const pokeUser = require('./pokeUser.js');

const app = express()
const port = 5000
var pokeModel = null;

const start = asyncWrapper(async (req, res, next) => {
    await connectDB();
    const pokeSchema = await getTypes();
    pokeModel = await populatePokemons(pokeSchema);
    app.listen(port, () => {
        if (err)
            throw new PokemonDbError(err);
        else
            console.log(`phew! server is running on port: ${process.env.PORT}`);
    })
})

start();
app.use(express.json());

const bcrypt = require("bcrypt")
app.post('/register', asyncWrapper(async (req, res) => {
  const { username, password, email } = req.body
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)
  const userWithHashedPassword = { ...req.body, password: hashedPassword }

  const user = await pokeUser.create(userWithHashedPassword)
  res.send(user)
}))

const jwt = require("jsonwebtoken")
app.post('/login', asyncWrapper(async (req, res) => {
  const { username, password } = req.body
  const user = await pokeUser.findOne({ username })
  if (!user) {
    throw new PokemonBadRequest("User not found")
  }
  const isPasswordCorrect = await bcrypt.compare(password, user.password)
  if (!isPasswordCorrect) {
    throw new PokemonBadRequest("Password is incorrect")
  }

  // Create and assign a token
  const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET)
  res.header('auth-token', token)

  res.send(user)
}))

const auth = (req, res, next) => {
const token = req.header('auth-token')
  if (!token) {
    throw new PokemonBadRequest("Access denied")
  }
  try {
    const verified = jwt.verify(token, process.env.TOKEN_SECRET) // nothing happens if token is valid
    next()
  } catch (err) {
    throw new PokemonBadRequest("Invalid token")
  }
}

app.get('/api/v1/pokemons', asyncWrapper(async (req, res) => {
    if (!req.query["count"])
      req.query["count"] = 10
    if (!req.query["after"])
      req.query["after"] = 0
    const docs = await pokeModel.find({})
      .sort({ "id": 1 })
      .skip(req.query["after"])
      .limit(req.query["count"])
    res.json(docs)
  }))

app.get('/api/v1/pokemon/:id', asyncWrapper(async (req, res) => {
const { id } = req.params
const docs = await pokeModel.find({ "id": id })
if (docs.length != 0) res.json(docs)
else res.json({ errMsg: "Pokemon not found" })
}))

app.use(express.json())

app.post('/api/v1/pokemon/', asyncWrapper(async (req, res) => {
  if (!req.body.id) throw new PokemonBadRequestMissingID()
  const poke = await pokeModel.find({ "id": req.body.id })
  if (poke.length != 0) throw new PokemonDuplicateError()
  const pokeDoc = await pokeModel.create(req.body)
  res.json({
    msg: "Added Successfully"
  })
}))

app.delete('/api/v1/pokemon/:id', asyncWrapper(async (req, res) => {
    const docs = await pokeModel.findOneAndRemove({ id: req.params.id })
    if (docs)
      res.json({
        msg: "Deleted Successfully"
      })
    else
      throw new PokemonNotFoundError("");
  }))

app.put('/api/v1/pokemon/:id', asyncWrapper(async (req, res) => {
const selection = { id: req.params.id }
const update = req.body
const options = {
    new: true,
    runValidators: true,
    overwrite: true
}
const doc = await pokeModel.findOneAndUpdate(selection, update, options)
if (doc) {
    res.json({
    msg: "Updated Successfully",
    pokeInfo: doc
    })
} else {
    throw new PokemonNotFoundError("");
}
}))

app.patch('/api/v1/pokemon/:id', asyncWrapper(async (req, res) => {
const selection = { id: req.params.id }
const update = req.body
const options = {
    new: true,
    runValidators: true
}
const doc = await pokeModel.findOneAndUpdate(selection, update, options)
if (doc) {
    res.json({
    msg: "Updated Successfully",
    pokeInfo: doc
    })
} else {
    throw new PokemonNotFoundError("");
}
}))

app.get("*", (req, res) => {
throw new PokemonNoSuchRouteError("");
})


app.use(handleErr)


app.get("/pokemonsAdvancedFiltering", async (req, res) => {
    const comparisonOperators = req.query.comparisonOperators
    const filters = comparisonOperators.split(",").map((operator) => operator.trim());
    const filterRegex = /(\w+)([<>=]+)(\w+)/;
    let query = {}
    filters.map((filter) => {
        const match = filter.match(filterRegex);
    
        if (match) {
            const field = match[1];
            const operator = match[2];
            const value = match[3];

            if (operator === "=") {
                query[field] = value;
            } else if (operator === ">") {
                query[field] = { $gt: value };
            } else if (operator === "<") {
                query[field] = { $lt: value };
            } else if (operator === ">=") {
                query[field] = { $gte: value };
            } else if (operator === "<=") {
                query[field] = { $lte: value };
            } else if (operator === "!=") {
                query[field] = { $ne: value };
            }
        }
    })

    const pokemons = await pokeModel.find(match);
    res.send(pokemons);

})

app.patch("/pokemonsAdvancedFiltering"), async (req, res) => {
    const pushOperator = req.query.pushOperator
    const filters = pushOperator.split(",").map((operator) => operator.trim());
    const filterRegex = [];
    
    const pokemons = await pokeModel.find(query);
    res.send(pokemons);
}

// - get a pokemon Image URL
app.get('/api/v1/pokemonImage/:id', (req, res) => {
    res.send(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${req.params.id}.png`)
})

app.get('*', function(req, res){
    res.status(404).json({errMsg: 'Improper route'});
});
    