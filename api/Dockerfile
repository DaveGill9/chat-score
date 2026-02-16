# ------------------------------------
# 1. Stage: Build (for compilation)
# ------------------------------------
    FROM node:20 AS build

    # Set the working directory for the build stage
    WORKDIR /usr/src/app
    
    # Install dependencies (Layer 1: Caches if package*.json is unchanged)
    COPY package*.json ./
    RUN npm ci
    
    # Copy source files and configuration needed for the build (Layer 2: Invalidates cache if source changes)
    # Assuming your source code is in 'src' and compilation config is at the root
    COPY src ./src
    COPY nest-cli.json .
    COPY tsconfig*.json .
    
    # Run the build command (Layer 3: Generates the 'dist' folder)
    RUN npm run build
    
    
    # ------------------------------------
    # 2. Stage: Production (for runtime)
    # ------------------------------------
    # Use a smaller, secure runtime base image
    FROM node:20-slim AS production
    
    # Set the working directory for the final application
    WORKDIR /api
    
    # 1. Copy the compiled build output ('dist' folder)
    # This crucial step ensures /api/dist/main exists for the CMD.
    COPY --from=build /usr/src/app/dist ./dist 
    
    # 2. Copy production dependencies
    COPY --from=build /usr/src/app/node_modules ./node_modules
    
    # 3. Copy runtime config files (e.g., package.json for npm start, environment files)
    COPY package*.json .
    
    # Expose the application port
    EXPOSE 3000
    
    # Set the environment variable for production
    ENV NODE_ENV=production
    
    # The command to start the application
    CMD ["npm", "run", "start:prod"]