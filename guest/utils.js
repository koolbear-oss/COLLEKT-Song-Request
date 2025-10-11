/**
 * Automatically formats song titles with proper capitalization
 * @param {string} title - The song title to format
 * @returns {string} - Formatted song title
 */
function formatSongTitle(title) {
  if (!title) return "";
  
  // Articles, conjunctions, and prepositions to keep lowercase
  const smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'as', 'at', 
                      'by', 'for', 'from', 'in', 'into', 'near', 'of', 'on', 'onto', 
                      'to', 'with', 'yet'];
  
  // Split by spaces and handle each word
  return title.split(' ')
    .map((word, index) => {
      // Always capitalize the first word and words after colon
      if (index === 0 || title.charAt(index - 2) === ':') {
        return capitalizeWord(word);
      }
      
      // Keep small words lowercase unless they're the last word
      if (smallWords.includes(word.toLowerCase()) && index !== title.split(' ').length - 1) {
        return word.toLowerCase();
      }
      
      // Special handling for acronyms, like "DJ", "EP", "USA"
      if (word.length <= 3 && word === word.toUpperCase()) {
        return word;
      }
      
      // For regular words, capitalize the first letter
      return capitalizeWord(word);
    })
    .join(' ');
}

/**
 * Formats artist names with proper capitalization
 * @param {string} artist - The artist name to format
 * @returns {string} - Formatted artist name
 */
function formatArtistName(artist) {
  if (!artist) return "";
  
  // Special cases for artist name formats
  // For "feat." or "ft." appearances
  if (artist.toLowerCase().includes(' feat. ') || artist.toLowerCase().includes(' ft. ')) {
    const parts = artist.split(/(feat\.|ft\.)/i);
    
    // Format the main artist
    const mainArtist = formatArtistNamePart(parts[0].trim());
    
    // Format the featured artist
    let result = mainArtist;
    if (parts.length >= 3) {
      const featText = parts[1].toLowerCase();
      const featuredArtist = formatArtistNamePart(parts[2].trim());
      result += ` ${featText} ${featuredArtist}`;
    }
    
    return result;
  }
  
  // For collaborations with "&" or "and"
  return artist.split(/ & | and /i)
    .map(name => formatArtistNamePart(name.trim()))
    .join(' & ');
}

/**
 * Helper function to format a single artist name
 * @param {string} name - The artist name part
 * @returns {string} - Formatted name part
 */
function formatArtistNamePart(name) {
  if (!name) return "";
  
  // Handle name parts separated by spaces
  return name.split(' ')
    .map(part => {
      // Special handling for prefixes like "Mc" or "O'"
      if (part.toLowerCase().startsWith('mc') && part.length > 2) {
        return 'Mc' + capitalizeWord(part.substring(2));
      }
      if (part.toLowerCase().startsWith('o\'') && part.length > 2) {
        return 'O\'' + capitalizeWord(part.substring(2));
      }
      // DJ should be uppercase
      if (part.toLowerCase() === 'dj') {
        return 'DJ';
      }
      return capitalizeWord(part);
    })
    .join(' ');
}

/**
 * Helper function to capitalize a word properly
 * @param {string} word - The word to capitalize
 * @returns {string} - Capitalized word
 */
function capitalizeWord(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}