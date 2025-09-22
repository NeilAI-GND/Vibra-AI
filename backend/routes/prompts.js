const express = require('express');
const promptMatcher = require('../services/PromptMatcher');

const router = express.Router();











// Get all prompts
router.get('/all', async (req, res) => {
  try {
    const prompts = await promptMatcher.getAllPrompts();
    res.json({ prompts, count: prompts.length });
  } catch (error) {
    console.error('Error getting prompts:', error);
    res.status(500).json({ 
      error: 'Failed to get prompts', 
      details: error.message 
    });
  }
});

// Get prompts by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const prompts = await promptMatcher.getPromptsByCategory(category);
    res.json({ prompts, count: prompts.length, category });
  } catch (error) {
    console.error('Error getting prompts by category:', error);
    res.status(500).json({ 
      error: 'Failed to get prompts by category', 
      details: error.message 
    });
  }
});

// Smart prompt matching endpoint
router.post('/match', async (req, res) => {
  try {
    const { userInput, category, userTier = 'free', limit = 5 } = req.body;
    
    if (!userInput || userInput.trim().length === 0) {
      return res.status(400).json({ error: 'User input is required' });
    }
    
    const matches = await promptMatcher.findMatches(
      userInput.trim(), 
      userTier, 
      category, 
      limit
    );
    
    res.json({
      matches,
      query: userInput,
      category,
      userTier
    });
    
  } catch (error) {
    console.error('Error matching prompts:', error);
    res.status(500).json({ 
      error: 'Failed to match prompts', 
      details: error.message 
    });
  }
});

// Get best match for user input
router.post('/best-match', async (req, res) => {
  try {
    const { userInput, category, userTier = 'free' } = req.body;
    
    if (!userInput || userInput.trim().length === 0) {
      return res.status(400).json({ error: 'User input is required' });
    }
    
    const bestMatch = await promptMatcher.findBestMatch(
      userInput.trim(), 
      userTier, 
      category
    );
    
    if (!bestMatch) {
      return res.json({ 
        match: null, 
        message: 'No matching prompts found' 
      });
    }
    
    res.json({
      match: bestMatch,
      query: userInput,
      category,
      userTier
    });
    
  } catch (error) {
    console.error('Error finding best match:', error);
    res.status(500).json({ 
      error: 'Failed to find best match', 
      details: error.message 
    });
  }
});

// Get available categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await promptMatcher.getCategories();
    res.json({ categories });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ 
      error: 'Failed to get categories', 
      details: error.message 
    });
  }
});

// Get available styles
router.get('/styles', async (req, res) => {
  try {
    const styles = await promptMatcher.getStyles();
    res.json({ styles });
  } catch (error) {
    console.error('Error getting styles:', error);
    res.status(500).json({ 
      error: 'Failed to get styles', 
      details: error.message 
    });
  }
});

// Get prompt statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await promptMatcher.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      error: 'Failed to get statistics', 
      details: error.message 
    });
  }
});

// Reload prompts (useful after upload)
router.post('/reload', async (req, res) => {
  try {
    await promptMatcher.reloadPrompts();
    const stats = await promptMatcher.getStats();
    res.json({ 
      message: 'Prompts reloaded successfully',
      stats
    });
  } catch (error) {
    console.error('Error reloading prompts:', error);
    res.status(500).json({ 
      error: 'Failed to reload prompts', 
      details: error.message 
    });
  }
});



module.exports = router;