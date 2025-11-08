const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema
const tripSchema = new Schema({
    name: {
      type: String,
      required: true
    },
    location:{
      type:String,
      required: true
    },
    users: {
      type: [Object],
      required: true,
    },
    owner:{
      type: Object,
      required:true
    },
    tripModel:{
        type:Object,
        required:true,
    }
  });
  
  // Create a model based on the schema
  const Trip = mongoose.model('Trip', tripSchema);
  
  module.exports = Trip;