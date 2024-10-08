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
  model: "gemini-1.5-flash",
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
    // safetySettings: Adjust safety settings
    // See https://ai.google.dev/gemini-api/docs/safety-settings
    history: [
      {
        role: "user",
        parts: [
          {
            text: 'with following format - [{day:1,date: "05/09/2024", activity:[{activity_name,activity_location,activity_description}]}] create a {5} day, day by day itinerary to {paris}, including 2-3 activities a day ',
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: 'with following format - [{day:1,date: "05/09/2024", activity:[{activity_name,activity_location,activity_description}]}] create a {6} day [start date: 10/10/2024, end date 16/10/2024], day by day itinerary to {paris}, including 2-3 activities a day \n',
          },
        ],
      },
    ],
  });

  const AIResult = await chatSession.sendMessage(prompt);

  let result = AIResult.response.text();

  //console.log(result)
  let jsonRes = JSON.parse(result);
  //console.log(jsonRes)
  return jsonRes;
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
      {
        role: "user",
        parts: [
          {
            text: "with the following format - places:[{activity_name,activity_location,activity_description,location_type}] suggest 3 place for a trip near old manali at manali, categories location_type from following types - [Beach, Museum, Location, Hotel, Travel, Sight Seeing, Market, Shopping, Historical sites, Restaurant, Bar], give only json data",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "[{activity_name: Old Manali Village Walk, activity_location: Old Manali, activity_description: Explore the charming streets of Old Manali, with its Tibetan shops, cafes, and guesthouses., location_type: Sight Seeing}, {activity_name: Hadimba Temple, activity_location: Old Manali, activity_description: Visit the ancient Hadimba Temple, dedicated to the wife of Bhima, one of the Pandava brothers from the Hindu epic Mahabharata., location_type: Historical sites}, {activity_name: Jogini Falls, activity_location: Near Old Manali, activity_description: Hike to the beautiful Jogini Falls, a serene waterfall nestled amidst the mountains., location_type: Sight Seeing}]\n\n",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: "with the following format - places:[{activity_name,activity_location,activity_description,location_type}] suggest 3 place for a trip near CN tower at toronto, categories location_type from following types - [Beach, Museum, Location, Hotel, Travel, Sight Seeing, Market, Shopping, Historical sites, Restaurant, Bar], give only json data",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "[{activity_name: Ripley's Aquarium of Canada, activity_location: Downtown Toronto, activity_description: Explore a vast underwater world with diverse marine life at Ripley's Aquarium., location_type: Museum}, {activity_name: St. Lawrence Market, activity_location: Downtown Toronto, activity_description: Browse through local produce, artisan goods, and food vendors at the historic St. Lawrence Market., location_type: Market}, {activity_name: The Distillery District, activity_location: Downtown Toronto, activity_description: Discover this charming Victorian-era district filled with art galleries, boutiques, restaurants, and bars., location_type: Shopping}]\n\n",
          },
        ],
      },
    ],
  });

  const AIResult = await chatSession.sendMessage(prompt);

  let result = AIResult.response.text();
  //console.log(result)
  let jsonRes = JSON.parse(result);
  //console.log(jsonRes)
  return jsonRes;
}

module.exports =  {findAndAddImage, checkInS3 ,callGenerativeAPI,callSuggestionGenerativeAPI };