const express = require("express");
const router = express.Router();
const Trip = require("./trip.model");
const externalFunctions = require('./externalFunctions')



router.get("/list", async (req, res) => {
  const user = req.user;
  try {
    let owned_trips = (await Trip.find({ "owner.id": user.id })).reverse();
    let shared_trips = (
      await Trip.find({ users: { $elemMatch: { _id: user.id } } })
    ).reverse();

    let all_trips = {
      owned_trips: owned_trips,
      shared_trips: shared_trips,
    };

    res.json(all_trips);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.get("/trip/:id", async (req, res) => {
  let _id = req.params.id.toString();
  let user = req.user;

  try {
    
    let trip = await Trip.findById(_id);

    if (!trip) {
      return res.status(400).send({ msg: "No trip with this id" });
    }

    let userInSharedList = false;
    for (let i = 0; i < trip.users.length; i++) {
      if (trip.users[i]._id == user.id) {
        userInSharedList = true;
        continue;
      }
    }

    if (trip.owner.id != user.id && userInSharedList == false) {
      return res.status(400).send({ msg: "Not allowed to see this Trip" });
    }

    if (userInSharedList == true) {
      trip.tripModel.sharedView = true;
    } else {
      trip.tripModel.sharedView = false;
    }

    return res.send(trip);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.post("/create", async (req, res) => {
  let user = req.user;

  let { name, location, tripModel } = req.body;

  let trip = new Trip({
    name: name,
    location,
    users: [],
    owner: user,
    tripModel,
  });

  let image_data = await externalFunctions.findAndAddImage(location);

  if (image_data == "Server Error") {
    return res.status(400).send({ msg: "Nice try, give a real place" });
  }

  trip.tripModel.image = image_data;
  trip.tripModel.location = location.toUpperCase();
  trip.tripModel.latandlong = image_data.latandlong;

  let start_date = tripModel.days.startDate;
  let end_date = tripModel.days.endDate;
  let days = tripModel.days.days;

  let activity_level;

  if (tripModel.activityLevel.description == "less") {
    activity_level = "2";
  } else if (tripModel.activityLevel.description == "balanced") {
    activity_level = "3";
  } else {
    activity_level = "4";
  }

  let tripItinerary = await externalFunctions.callGenerativeAPI(
    trip.tripModel.location,
    days,
    start_date,
    end_date,
    activity_level
  );

  //for image of each day
  // for(let i=0;i<tripItinerary.length;i++){
  //   tripItinerary[i].image = await findAndAddImage(tripItinerary[i].activity[0].activity_location)
  // }


  tripModel.trip = tripItinerary;

  try {
    await trip.save();
    res.status(201).json({ message: "Trip Saved", trip: trip });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



router.patch("/update", async (req, res) => {
  let body = req.body;
  let trip_id = body._id
  try{
    
    let trip = await Trip.findOneAndUpdate({ _id: trip_id },body,{new:true});
    

    if(trip){
      return res.send({msg:"trip saved successfully",trip:trip})
    }else{
      return res.status(400).send({msg:"Incorrect updates provided"})
    }
    

  }catch(err){
    console.log(err)
    res.status(500).send("Some error happened in server")
  }

});


router.post("/delete",async(req,res)=>{
  let trip = req.body
  console.log(trip)
  let owner_user = req.user
  console.log(owner_user)
  try{
    
    if(trip.owner.id != owner_user.id){
      console.log("cannot delete")
      return res.status(400).send({msg:"You can not delete this trip as you do not own it"})
    }

    let result = await Trip.findByIdAndDelete({_id:trip._id})

    if(!result){
      return res.status(400).send({msg:"This trip does not exist"})
    }
    else{
      return res.send({msg:"trip deleted"})
    }

  }catch{
    return res.status(500).send({msg:"some server error"})
  }


})

router.post("/suggestion",async(req,res)=>{
  let {previousLocation,trip_location} = req.body

  try{
    let AISuggestion = await externalFunctions.callSuggestionGenerativeAPI(previousLocation,trip_location,3)
    
    console.log(AISuggestion)
    
    return res.send(AISuggestion)

  }catch(err){
    console.log(err)
    return res.status(500).send({msg:"some server error"})
  }
})

router.post("/saveLocalTrip",async (req,res)=>{
  let user = req.user;
  let trip = (req.body.trip)
  trip = {...trip, owner:user}

  try{
    
    let savedTrip = await Trip.findOneAndUpdate({ _id: trip._id },trip,{new:true});
  
    if(savedTrip){
      return res.send({msg:"trip saved successfully",trip:trip})
    }else{
      return res.status(400).send({msg:"Incorrect updates provided"})
    }
    

  }catch(err){
    console.log(err)
    res.status(500).send("Some error happened in server")
  }

})

router.post("/share", async (req, res) => {
  let owner_user = req.user;

  let { user_to_share, trip_id } = req.body;

  try {
    let trip = await Trip.findOne({ _id: trip_id });

    if (!trip) {
      return res.status(400).json({ msg: "Trip not found" });
    }

    if (user_to_share._id == trip.owner.id) {
      return res.status(400).json({ msg: "Cannot share to yourself" });
    }

    if (trip.owner.id != owner_user.id) {
      return res.status(400).json({ msg: "You are not owner of this trip" });
    }

    let userFound = false;

    for (let i = 0; i < trip.users.length; i++) {
      if (trip.users[i]._id == user_to_share._id) {
        userFound = true;
        continue;
      }
    }

    if (userFound) {
      return res.status(400).json({ msg: "Already shared" });
    }

    trip.users.push(user_to_share);

    await trip.save();

    return res.status(201).json({ message: "Trip Shared", trip: trip });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});


module.exports = router;
