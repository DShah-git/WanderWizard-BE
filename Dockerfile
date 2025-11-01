# Use official Node.js image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package.json first (for cached installs)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Expose app port (if running a server)
EXPOSE 3000

# Command to run app
CMD ["node", "index.js"]