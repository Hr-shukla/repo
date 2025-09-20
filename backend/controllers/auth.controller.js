import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { HfInference } from '@huggingface/inference';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

export const registerUser = async (req, res) => {
  const { username, password } = req.body;
  const userExists = await User.findOne({ username });

  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = await User.create({ username, password });

  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
};

export const loginUser = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      username: user.username,
      bio: user.bio,
      profilePicture: user.profilePicture,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'Invalid username or password' });
  }
};

// Hugging Face Image Generation
export const generateImage = async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
    }

    try {
        const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);
        const imageBlob = await hf.textToImage({
            model: 'stabilityai/stable-diffusion-2',
            inputs: prompt,
            parameters: {
                negative_prompt: 'blurry, ugly, deformed',
            }
        });

        // Convert blob to a buffer and then to base64 to send as JSON
        const arrayBuffer = await imageBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = imageBlob.type;

        res.json({ image: `data:${mimeType};base64,${base64Image}` });

    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ message: 'Failed to generate image', error: error.message });
    }
};
