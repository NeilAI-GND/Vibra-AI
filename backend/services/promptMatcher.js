const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class PromptMatcher {
  constructor() {
    this.prompts = [];
    this.csvPath = path.join(__dirname, '../data/prompts/master_prompts.csv');
    this.lastLoadTime = null;
  }

  // Load prompts from CSV file
  async loadPrompts() {
    try {
      if (!fs.existsSync(this.csvPath)) {
        console.log('No prompts CSV file found, using empty prompts array');
        this.prompts = [];
        return;
      }

      const stats = fs.statSync(this.csvPath);
      
      // Only reload if file has been modified
      if (this.lastLoadTime && stats.mtime <= this.lastLoadTime) {
        return;
      }

      this.prompts = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(this.csvPath)
          .pipe(csv())
          .on('data', (row) => {
            // Clean and validate row data
            const prompt = {
              id: `${row.category}_${this.prompts.length + 1}`,
              name: row.category?.toString().trim(),
              description: '',
              category: row.category?.toString().trim() || 'general',
              tags: '',
              main_prompt: row.main_prompt?.toString().trim(),
              negative_prompt: '',
              style: 'realistic',
              quality_level: 'high',
              user_tier: 'free',
              is_active: true
            };

            // Only add valid prompts
            if (prompt.category && prompt.main_prompt) {
              this.prompts.push(prompt);
            }
          })
          .on('end', () => {
            this.lastLoadTime = stats.mtime;
            console.log(`Loaded ${this.prompts.length} prompts from CSV`);
            resolve();
          })
          .on('error', (error) => {
            console.error('Error loading prompts:', error);
            reject(error);
          });
      });
    } catch (error) {
      console.error('Failed to load prompts:', error);
      throw error;
    }
  }

  // Get all prompts
  async getAllPrompts() {
    await this.loadPrompts();
    return this.prompts;
  }

  // Get prompts by category
  async getPromptsByCategory(category) {
    await this.loadPrompts();
    return this.prompts.filter(prompt => 
      prompt.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Get prompts by user tier
  async getPromptsByUserTier(userTier = 'free') {
    await this.loadPrompts();
    return this.prompts.filter(prompt => {
      if (userTier === 'premium') {
        return true; // Premium users can access all prompts
      }
      return prompt.user_tier === 'free';
    });
  }

  // Find prompt by exact ID
  async getPromptById(id) {
    await this.loadPrompts();
    return this.prompts.find(prompt => prompt.id === id);
  }

  // Smart matching based on user input
  async findBestMatch(userInput, userTier = 'free', category = null) {
    await this.loadPrompts();
    
    let availablePrompts = await this.getPromptsByUserTier(userTier);
    
    if (category) {
      availablePrompts = availablePrompts.filter(prompt => 
        prompt.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (availablePrompts.length === 0) {
      return null;
    }

    const input = userInput.toLowerCase();
    const matches = [];

    availablePrompts.forEach(prompt => {
      let score = 0;
      
      // Check name match
      if (prompt.name.toLowerCase().includes(input)) {
        score += 10;
      }
      
      // Check description match
      if (prompt.description.toLowerCase().includes(input)) {
        score += 5;
      }
      
      // Check tags match
      const tags = prompt.tags.toLowerCase().split(',').map(tag => tag.trim());
      tags.forEach(tag => {
        if (input.includes(tag) || tag.includes(input)) {
          score += 3;
        }
      });
      
      // Check category match
      if (prompt.category.toLowerCase().includes(input)) {
        score += 2;
      }
      
      // Check style match
      if (prompt.style.toLowerCase().includes(input)) {
        score += 2;
      }
      
      // Keyword matching in main prompt
      const inputWords = input.split(' ').filter(word => word.length > 2);
      inputWords.forEach(word => {
        if (prompt.main_prompt.toLowerCase().includes(word)) {
          score += 1;
        }
      });
      
      if (score > 0) {
        matches.push({ prompt, score });
      }
    });

    // Sort by score and return best match
    matches.sort((a, b) => b.score - a.score);
    
    return matches.length > 0 ? matches[0].prompt : availablePrompts[0]; // Return best match or first available
  }

  // Get multiple matches for user selection
  async findMatches(userInput, userTier = 'free', category = null, limit = 5) {
    await this.loadPrompts();
    
    let availablePrompts = await this.getPromptsByUserTier(userTier);
    
    if (category) {
      availablePrompts = availablePrompts.filter(prompt => 
        prompt.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (availablePrompts.length === 0) {
      return [];
    }

    const input = userInput.toLowerCase();
    const matches = [];

    availablePrompts.forEach(prompt => {
      let score = 0;
      
      // Same scoring logic as findBestMatch
      if (prompt.name.toLowerCase().includes(input)) score += 10;
      if (prompt.description.toLowerCase().includes(input)) score += 5;
      
      const tags = prompt.tags.toLowerCase().split(',').map(tag => tag.trim());
      tags.forEach(tag => {
        if (input.includes(tag) || tag.includes(input)) score += 3;
      });
      
      if (prompt.category.toLowerCase().includes(input)) score += 2;
      if (prompt.style.toLowerCase().includes(input)) score += 2;
      
      const inputWords = input.split(' ').filter(word => word.length > 2);
      inputWords.forEach(word => {
        if (prompt.main_prompt.toLowerCase().includes(word)) score += 1;
      });
      
      if (score > 0) {
        matches.push({ ...prompt, matchScore: score });
      }
    });

    // Sort by score and return top matches
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    return matches.slice(0, limit);
  }

  // Get available categories
  async getCategories() {
    await this.loadPrompts();
    const categories = [...new Set(this.prompts.map(prompt => prompt.category))];
    return categories.sort();
  }

  // Get available styles
  async getStyles() {
    await this.loadPrompts();
    const styles = [...new Set(this.prompts.map(prompt => prompt.style))];
    return styles.sort();
  }

  // Force reload prompts (useful after upload)
  async reloadPrompts() {
    this.lastLoadTime = null;
    await this.loadPrompts();
  }

  // Get prompt statistics
  async getStats() {
    await this.loadPrompts();
    
    const stats = {
      total: this.prompts.length,
      categories: {},
      styles: {},
      userTiers: {},
      qualityLevels: {}
    };

    this.prompts.forEach(prompt => {
      // Count by category
      stats.categories[prompt.category] = (stats.categories[prompt.category] || 0) + 1;
      
      // Count by style
      stats.styles[prompt.style] = (stats.styles[prompt.style] || 0) + 1;
      
      // Count by user tier
      stats.userTiers[prompt.user_tier] = (stats.userTiers[prompt.user_tier] || 0) + 1;
      
      // Count by quality level
      stats.qualityLevels[prompt.quality_level] = (stats.qualityLevels[prompt.quality_level] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
module.exports = new PromptMatcher();