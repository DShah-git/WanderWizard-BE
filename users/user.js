const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../db/db')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./user.model'); // Import the User model
const authMiddleware = require('../middleware/auth.middleware')


// Registration route
router.post('/register', async (req, res) => {

    const { name, email, password } = req.body;
  
    if (!name || !email || !password) {
      return res.status(400).json({ msg: 'Please enter all fields' });
    }
  
    try {
      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }
  
      let image = `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${name}&flip=true&backgroundColor=ecad80,f2d3b1,ffdfbf&backgroundType=gradientLinear`

      // Create a new user
      user = new User({
        name,
        email,
        password,
        image
      });
  
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
  
      // Save the user
      await user.save();
      res.status(201).json({ msg: 'User registered successfully' });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

  // Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }


  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Generate JWT
    const payload = {
      id: user._id,
      name: user.name,
      image: user.image
    };

    const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '24h' });

    res.cookie('authToken', token, {
      httpOnly: false,   
      secure: false,     
      sameSite: 'lax', 
      maxAge: 86400000    
    });


    return res.json({
      token:token,
      user: payload
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


router.get('/isLoggedIn',authMiddleware,async(req,res)=>{
  res.json({isLoggedIn:true});
})

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // Find the user by ID from the token
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post("/findUserToShare",authMiddleware, async (req, res) => {
  let searchString = req.body.searchString;
  let current_user = req.user

  try{
    let users = await User.find({"email": {"$regex": `.*${searchString}*.` , "$options": "i"}}).select('-password').select("-__v");
    
    users = users.filter((u) => u._id.toString() !== current_user.id);

    res.send(users)
  }catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
    


})  



module.exports = router;