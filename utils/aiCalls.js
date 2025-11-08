const axios = require("axios");
const sharp = require("sharp"); // For image processing
const AWS = require("aws-sdk");

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.google_gemini_key);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

AWS.config.update({
  accessKeyId: process.env.access_key,
  secretAccessKey: process.env.secret_key,
  region: "us-east-1",
});

let google_key = process.env.google_key;

const s3 = new AWS.S3();

async function findAndAddImage(location) {
  try {
    //api to get place from google
    let locationResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${location}&key=${google_key}`
    );

    console.log(locationResponse.data);

    // get info from first Image
    let google_image = locationResponse.data.results[0].photos[0];
    let google_location_id = locationResponse.data.results[0].place_id;
    let google_location_name = locationResponse.data.results[0].name;
    let latandlong = locationResponse.data.results[0].geometry.location;

    let image_exists = await checkInS3(google_location_id);

    console.log(locationResponse.data.results[0].photos)

    //check if the image for this location exist in s3 return that object
    if (image_exists) {
      return {
        msg: "Location image found in s3",
        google_location_id,
        google_location_name,
        latandlong,
        image_path:
          "https://wanderwizard.s3.amazonaws.com/" +
          google_location_id +
          ".jpg",
      };
    }

    //get photo reference
    let photo_ref = google_image.photo_reference;

    //make request to google based on image_reference
    let req_url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=2000&photo_reference=${photo_ref}&key=${google_key}`;
    let image_res = await axios.get(req_url, { responseType: "arraybuffer" });
    let response_image = image_res.data;

    // process raw image data
    const processedImageBuffer = await sharp(response_image)
      .resize(2000)
      .toBuffer();

    // Optionally save the image to disk
    // fs.writeFileSync(`./images-saved/${google_location_id}.jpg`, processedImageBuffer)

    // upload image to s3 based on location data
    let image_path = await uploadtoS3(processedImageBuffer, google_location_id);

    let returnObj = {
      msg: "New image from google saved to S3",
      image_path,
      google_location_id,
      google_location_name,
      latandlong,
    };

    return returnObj;
  } catch (err) {
    console.log(err);
    return "Server Error";
  }
}

async function uploadtoS3(file, location_id) {
  const uploadParams = {
    Bucket: "wanderwizard",
    Key: location_id + ".jpg",
    Body: file,
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    // Return the public URL
    return data.Location;
  } catch (error) {
    console.error("Error uploading file:", error);
    return "Server Error";
  }
}

async function checkInS3(location_id) {
  const params = {
    Bucket: "wanderwizard",
    Key: location_id + ".jpg",
  };

  try {
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === "NotFound") {
      return false;
    } else {
      throw error;
    }
  }
}

async function callGenerativeAPI(
  location,
  days,
  start_date,
  end_date,
  activity_level
) {
  let prompt = `with following format - [{day:1,date: 'dd/mm/yyyy', activity:[{activity_name,activity_location,activity_description,location_type}]}] create a ${days} day [from:${start_date},  to:${end_date}], day by day itinerary to ${location}, including ${activity_level} activities a day. 
    categories location_type from following types - [Beach, Museum, Location, Hotel, Travel, Sight Seeing, Market, Shopping, Historical sites, Restaurant, Bar]`;

  const chatSession = model.startChat({
    generationConfig,
    history: [
    ],
  });

  const AIResult = await chatSession.sendMessage(prompt);

  let result = AIResult.response.text();

  //console.log(result)
  let jsonRes = JSON.parse(result);
  //console.log(jsonRes)
  return jsonRes;
}

async function getAILocationDescription(location){
  let prompt = `Give me a brief 7-10 line description of why people go to ${location}. Return JSON in following format - {"description":"answer"}`;

  const chatSession = model.startChat({
    generationConfig,
    history: [
    ],
  });

  const AIResult = await chatSession.sendMessage(prompt);

  let result = AIResult.response.text();

  return JSON.parse(result)
}

async function callSuggestionGenerativeAPI(
  previousLocation,
  trip_location,
  no_of_suggestion
) {
  let prompt = `with the following format - places:[{activity_name,activity_location,activity_description,location_type}] suggest ${no_of_suggestion} place for a trip near ${previousLocation} in ${trip_location}, categories location_type from following types - [Beach, Museum, Location, Hotel, Travel, Sight Seeing, Market, Shopping, Historical sites, Restaurant, Bar], give only json data`;

  const chatSession = model.startChat({
    generationConfig,
    history: [
     
    ],
  });

  const AIResult = await chatSession.sendMessage(prompt);

  let result = AIResult.response.text();
  //console.log(result)
  let jsonRes = JSON.parse(result);
  //console.log(jsonRes)
  return jsonRes;
}

module.exports =  {findAndAddImage, checkInS3 ,callGenerativeAPI,callSuggestionGenerativeAPI, getAILocationDescription };