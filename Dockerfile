# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the Vite default port
EXPOSE 5173

# Command to run the development server
# --host 0.0.0.0 is needed so the server can be accessed outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
