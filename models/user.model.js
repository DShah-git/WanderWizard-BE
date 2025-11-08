const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema
const userSchema = new Schema({
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    image: {
        type: String,
        required: true
    },
    password:{
        type:String,
        required:true
    }
  });
  
  // Create a model based on the schema
  const User = mongoose.model('User', userSchema);
  
  module.exports = User;