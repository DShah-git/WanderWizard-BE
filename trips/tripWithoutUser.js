const express = require("express");
const router = express.Router();
const Trip = require("./trip.model");
const externalFunctions = require('./externalFunctions')

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


module.exports = router;
