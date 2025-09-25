#!/usr/bin/env node

/**
 * Vibra AI - Entry Point
 * This file serves as the main entry point for Render deployment
 * It redirects to the actual backend server located in the backend directory
 */

// Import the backend server
require('./backend/server.js');