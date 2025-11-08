const express = require("express");
const router = express.Router();
const Trip = require("../models/trip.model");
const externalFunctions = require('../utils/aiCalls')

router.post("/create", async (req, res) => {
    
    let { name, location, tripModel } = req.body;

  let trip = new Trip({
    name: name,
    location,
    users: [],
    owner: {},
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

  // let description = await externalFunctions.getAILocationDescription(trip.tripModel.location)

  // tripModel.locationDescription = description.description

  // will add kafka connection here which will save job ID in mongoDB.

  let tripItinerary = await externalFunctions.callGenerativeAPI(
    trip.tripModel.location,
    days,
    start_date,
    end_date,
    activity_level
  );


  tripModel.trip = tripItinerary;

  try {
    await trip.save();
    res.status(201).json({ message: "Trip Saved", trip: trip });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }

});


router.post('/test-description',async (req,res) => {

  let {location} = req.body

  let description = await externalFunctions.getAILocationDescription(location)

  return res.send(description)

})


router.get("/trip/:id", async (req, res) => {
  let _id = req.params.id.toString();


  try {
    
    let trip = await Trip.findById(_id);

    if (!trip) {
      return res.status(400).send({ msg: "No trip with this id" });
    }

    return res.send(trip);
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


module.exports = router;
