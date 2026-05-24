# Use a lightweight Node.js alpine image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies first (better caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (default 3737)
EXPOSE 3737

# Set environment variables
# DarkNotes stores data in ~/.darknotes/data.json by default.
# In the container, this will be /root/.darknotes/data.json.
ENV DARKNOTES_PORT=3737

# Run the server in API mode to serve the web app and REST API
CMD ["node", "server.js", "--both"]
