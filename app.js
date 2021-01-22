let port = 9001
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
let mongoose = require('mongoose');
let bodyParser = require('body-parser');
var Request = require("request");

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use(bodyParser.json());
app.use(logger('dev'));

// Mongoose
mongoose.connect("mongodb+srv://admin:YgyV7SmnmIBGbfGD@clustertheme.nyrvr.mongodb.net/LeaderboardDb?retryWrites=true&w=majority", {
  "useNewUrlParser": true,
  "socketTimeoutMS": 0,
  "keepAlive": true,
  "reconnectTries": 10
});

var trafficMadnessSchema = new mongoose.Schema({
  "playerId": String
  , "playerName": String
  , "levelName": String
  , "score": Number
});

let trafficMadness = mongoose.model("TrafficMadness", trafficMadnessSchema, "TrafficMadness");

app.get("/leaderboards/:levelName/:limit/:playerId", (req, res) => {
  process.on('uncaughtException', function (err) {
    console.error(err);
    return prepareUnsuccessfulResponse(false, res);
  });
  var limitReq = parseInt(req.params.limit, 10);
  var levelNameReq = req.params.levelName;
  var playerIdReq = req.params.playerId;

  var leaderboardData = "";

  if(limitReq > 0) {
    var sort = { score: -1 };
    trafficMadness.find({ levelName: { $eq: levelNameReq } }, { "playerId": true, "playerName": true, "levelName": true,"score" : true, "_id": false }).sort(sort).limit(limitReq).exec(function(err, leaderboards) {
      if (leaderboards != null && leaderboards.length > 0) {
        leaderboardData = leaderboards.map(leaderboard => ({ playerId: leaderboard.playerId, playerName: leaderboard.playerName, levelName: leaderboard.levelName, score: leaderboard.score }));
        trafficMadness.find({playerId : {$eq: playerIdReq}, levelName: levelNameReq}, { "playerId": true, "playerName": true, "levelName": true,"score" : true, "_id": false }).exec(function(err, players){
          if(players != null && players.length > 0) {
            return findPlayerDataAndReturnResponse(players, res, leaderboardData, levelNameReq);
          }
          else {
            res.status(200).send(prepareSuccessfulResponse(leaderboardData, "", 0));
          }
      });
      }
      else {
        return prepareUnsuccessfulResponse(true, res);
      }
    });
  }
  else {
    return prepareUnsuccessfulResponse(true, res);
  }
});

app.post("/leaderboards",(req,res) => {
  let playerInfo = req.body;
  trafficMadness.find({"playerId" : req.body.playerId, "levelName" : req.body.levelName},(err,docs) => {
    console.log(docs);
    if(err) {
      console.log(err);
    }
    if(docs.length > 0) {
      let oldScore = docs[0].score;
      if(playerInfo.score > oldScore) {
        docs[0].score = playerInfo.score;
        docs[0].save((err,doc) => {
          res.send(doc);
        });
      }
    } else {
      let tm = new trafficMadness(playerInfo);
      tm.save((err,doc) => {
        res.send(doc);
      });
    }
  });
})

app.post("/leaderboards/:playerId/:playerName",(req,res) => {
  let playerIdReq = req.params.playerId;
  let playerNameReq = req.params.playerName;
  trafficMadness.find({"playerId" : playerIdReq},(err,docs) => {
    console.log(docs);
    if(err) {
      console.log(err);
    }
    if(docs.length > 0) {
      docs.forEach(function(item){
          item.playerName = playerNameReq;
          item.save((err,item)=> {
          });
        });
    }
    res.send(docs);
  });
})

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
app.listen(port);
console.log("Server is running @ port ".concat(port));

function findPlayerDataAndReturnResponse(players, res, leaderboardData, levelNameReq) {
  var playerData = players.map(leaderboard => ({ playerId: leaderboard.playerId, playerName: leaderboard.playerName, levelName: leaderboard.levelName, score: leaderboard.score }));
  trafficMadness.find({ score: { $gte: playerData[0].score }, levelName: levelNameReq}).exec(function (err, playerRanks) {
    res.status(200).send(prepareSuccessfulResponse(leaderboardData, playerData, playerRanks.length));
  });
  return playerData;
}

function prepareSuccessfulResponse(leaderboardData, playerData, playerRank) {
  return {
    isSuccess: true,
    leaderboardData: leaderboardData,
    playerData: playerData,
    playerRank: playerRank
  };
}

function prepareUnsuccessfulResponse(isSuccess, res) {
  var responseData = {
    isSuccess: isSuccess,
    leaderboardData: null,
    playerData: null,
    playerRank: null
  };
  res.status(200).send(responseData);
  return responseData;
}
