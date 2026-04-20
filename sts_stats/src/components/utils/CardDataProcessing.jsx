// utils/CardDataProcessing.js
import cardDatabaseArray from './cardDatabase.json';

// Convert the array to a dictionary for easier lookup by ID
const cardDatabase = {};
cardDatabaseArray.forEach(card => {
  cardDatabase[card.id] = card;
  if (card.name) {
    cardDatabase[card.name.toUpperCase()] = card;
  }
});

// Helper function to normalize card ID (remove CARD. prefix and convert to database format)
export const normalizeCardId = (cardId) => {
  if (!cardId) return '';
  
  // Remove CARD. prefix if present
  let normalized = cardId.replace('CARD.', '');
  
  // Remove _UPGRADED suffix if present (for pairing stats)
  normalized = normalized.replace('_UPGRADED', '');
  
  return normalized;
};

// Get card from database by ID (handles both formats)
export const getCardFromDatabase = (cardId) => {
  if (!cardId) return null;
  
  // Try with CARD. prefix removed
  const withoutPrefix = cardId.replace('CARD.', '');
  if (cardDatabase[withoutPrefix]) {
    return cardDatabase[withoutPrefix];
  }
  
  // Try to find by name in the array (case-insensitive)
  const foundCard = cardDatabaseArray.find(card => 
    card.id === normalized ||
    card.id?.toUpperCase() === normalized ||
    card.name?.toUpperCase() === normalized ||
    card.id === withoutPrefix ||
    card.id === withoutUpgraded
  );
  
  return foundCard || null;
};

// Get base card ID (strip CARD. prefix and upgrade indicator)
export const getBaseCardId = (cardId) => {
  return normalizeCardId(cardId);
};

// Helper function to check if a card should be skipped
export const shouldSkipCard = (cardId) => {
  const baseId = getBaseCardId(cardId);
  return baseId.includes('STRIKE') || baseId.includes('DEFEND') ||
         baseId.includes('NEUTRALIZE') || baseId.includes('SURVIVOR') ||
         baseId.includes('BASH') || baseId.includes('ZAP') || baseId.includes('DUALCAST') ||
         baseId.includes('BODYGUARD') || baseId.includes('UNLEASH') ||
         baseId.includes('VENERATE') || baseId.includes('FALLING_STAR') ||
         baseId.includes('ASCENDERS_BANE');
};

// Extract upgraded cards from a run for a specific player
export const extractUpgradedCards = (mapPointHistory, playerId) => {
  const upgradedCardsSet = new Set();
  
  if (!mapPointHistory || !Array.isArray(mapPointHistory)) {
    return upgradedCardsSet;
  }
  
  for (const act of mapPointHistory) {
    if (!act || !Array.isArray(act)) continue;
    
    for (const point of act) {
      const playerStats = point.player_stats || [];
      for (const stats of playerStats) {
        if (stats.player_id === playerId && stats.upgraded_cards) {
          stats.upgraded_cards.forEach(cardId => {
            // Store normalized version
            upgradedCardsSet.add(normalizeCardId(cardId));
          });
        }
        
        if (stats.player_id === playerId && stats.card_choices) {
          stats.card_choices.forEach(choice => {
            if (choice.was_picked && choice.card && choice.card.current_upgrade_level === 1) {
              upgradedCardsSet.add(normalizeCardId(choice.card.id));
            }
          });
        }
        
        if (stats.player_id === playerId && stats.cards_transformed) {
          stats.cards_transformed.forEach(transform => {
            if (transform.final_card && transform.final_card.current_upgrade_level === 1) {
              upgradedCardsSet.add(normalizeCardId(transform.final_card.id));
            }
          });
        }
      }
    }
  }
  
  return upgradedCardsSet;
};

// Process a single deck and return card data with upgrade status
export const processDeck = (deck, upgradedCardsSet) => {
  const deckCards = [];
  
  if (!deck || !Array.isArray(deck)) {
    return deckCards;
  }
  
  deck.forEach(card => {
    const cardId = card.id;
    if (!cardId) return;
    
    // Normalize the card ID for consistent lookup
    const normalizedId = normalizeCardId(cardId);
    
    // Check if this card is upgraded (compare normalized IDs)
    const isUpgraded = card.current_upgrade_level === 1 || upgradedCardsSet.has(normalizedId);
    const baseCardId = normalizedId;
    
    // Skip starter cards
    if (shouldSkipCard(baseCardId)) return;
    
    const dbCard = getCardFromDatabase(baseCardId);
    
    deckCards.push({
      id: baseCardId,  // Store base ID for aggregation (without CARD. prefix)
      fullId: cardId,
      originalId: cardId,
      isUpgraded,
      name: dbCard?.name || baseCardId.replace(/_/g, ' '),
      dbCard: dbCard
    });
  });
  
  return deckCards;
};

// Process all runs and return detailed card data for analysis
export const processAllRunsData = (runData) => {
  
  if (!runData || !Array.isArray(runData)) {
    console.error('[processAllRunsData] runData is invalid:', runData);
    return [];
  }
  
  const runsData = [];
  
  runData.forEach((run, runIndex) => {
    const players = run.raw_data?.players || [];
    const wasWin = run.win;
    const ascension = run.raw_data?.ascension || 0;
    const mapPointHistory = run.raw_data?.map_point_history || [];
    
    players.forEach((player, playerIndex) => {
      const deck = player.deck || [];
      const playerId = player.id;
      
      const upgradedCardsSet = extractUpgradedCards(mapPointHistory, playerId);
      const deckCards = processDeck(deck, upgradedCardsSet);
      
      if (deckCards.length > 0) {
        runsData.push({
          runId: run.id || `run_${runIndex}_${playerIndex}`,
          win: wasWin,
          ascension,
          playerId,
          character: player.character,
          deck: deckCards,
          deckIds: deckCards.map(card => card.id),
          upgradedCount: deckCards.filter(card => card.isUpgraded).length
        });
      }
    });
  });
  
  return runsData;
};

// Calculate card stats (base and upgraded) from processed run data
export const calculateCardStats = (runsData) => {
  
  if (!runsData || !Array.isArray(runsData)) {
    console.error('[calculateCardStats] runsData is invalid');
    return {};
  }
  
  const stats = {};
  
  runsData.forEach(run => {
    const wasWin = run.win;
    const ascension = run.ascension;
    
    run.deck.forEach(card => {
      const cardId = card.id;
      const isUpgraded = card.isUpgraded;
      
      if (!stats[cardId]) {
        stats[cardId] = {
          id: cardId,
          name: card.name,
          baseAppearances: 0,
          baseWins: 0,
          baseLosses: 0,
          upgradedAppearances: 0,
          upgradedWins: 0,
          upgradedLosses: 0,
          baseAscensionData: {},
          upgradedAscensionData: {},
          dbCard: card.dbCard
        };
      }
      
      if (isUpgraded) {
        stats[cardId].upgradedAppearances++;
        if (wasWin) {
          stats[cardId].upgradedWins++;
        } else {
          stats[cardId].upgradedLosses++;
        }
        
        if (!stats[cardId].upgradedAscensionData[ascension]) {
          stats[cardId].upgradedAscensionData[ascension] = { wins: 0, losses: 0, appearances: 0 };
        }
        stats[cardId].upgradedAscensionData[ascension].appearances++;
        if (wasWin) {
          stats[cardId].upgradedAscensionData[ascension].wins++;
        } else {
          stats[cardId].upgradedAscensionData[ascension].losses++;
        }
      } else {
        stats[cardId].baseAppearances++;
        if (wasWin) {
          stats[cardId].baseWins++;
        } else {
          stats[cardId].baseLosses++;
        }
        
        if (!stats[cardId].baseAscensionData[ascension]) {
          stats[cardId].baseAscensionData[ascension] = { wins: 0, losses: 0, appearances: 0 };
        }
        stats[cardId].baseAscensionData[ascension].appearances++;
        if (wasWin) {
          stats[cardId].baseAscensionData[ascension].wins++;
        } else {
          stats[cardId].baseAscensionData[ascension].losses++;
        }
      }
    });
  });
  
  Object.values(stats).forEach(card => {
    card.baseWinRate = card.baseAppearances > 0 ? (card.baseWins / card.baseAppearances) * 100 : 0;
    card.upgradedWinRate = card.upgradedAppearances > 0 ? (card.upgradedWins / card.upgradedAppearances) * 100 : 0;
    card.winRate = card.baseWinRate;
    card.appearances = card.baseAppearances;
    
    card.baseAscensionArray = Object.entries(card.baseAscensionData)
      .map(([ascension, data]) => ({
        ascension: parseInt(ascension),
        winRate: data.appearances > 0 ? (data.wins / data.appearances) * 100 : 0,
        wins: data.wins,
        losses: data.losses,
        appearances: data.appearances
      }))
      .sort((a, b) => a.ascension - b.ascension);
    
    card.upgradedAscensionArray = Object.entries(card.upgradedAscensionData)
      .map(([ascension, data]) => ({
        ascension: parseInt(ascension),
        winRate: data.appearances > 0 ? (data.wins / data.appearances) * 100 : 0,
        wins: data.wins,
        losses: data.losses,
        appearances: data.appearances
      }))
      .sort((a, b) => a.ascension - b.ascension);
  });
  
  return stats;
};

// Calculate pairing stats from processed run data (treating upgraded and non-upgraded as same card)
export const calculatePairingStats = (runsData, selectedCardId, viewUpgraded = false) => {
  // Normalize the selected card ID for comparison
  const normalizedSelectedId = normalizeCardId(selectedCardId);
  
  if (!runsData || !Array.isArray(runsData) || runsData.length === 0) {
    console.error('[calculatePairingStats] No valid runs data provided');
    return {
      pairings: [],
      selectedCardStats: {
        appearances: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        upgradedCount: 0
      }
    };
  }

  const pairingData = {};
  let selectedCardTotalAppearances = 0;
  let selectedCardWins = 0;
  let selectedCardLosses = 0;
  let selectedCardUpgradedCount = 0;
  
  runsData.forEach((run, index) => {
    const wasWin = run.win;
    const deckIds = run.deckIds;
    
    // Check if selected card is in this deck using normalized ID
    const hasSelectedCard = deckIds && deckIds.includes(normalizedSelectedId);
    
    if (hasSelectedCard) {
      selectedCardTotalAppearances++;
      if (wasWin) {
        selectedCardWins++;
      } else {
        selectedCardLosses++;
      }
      
      // Count how many upgraded copies of the selected card are in this deck
      const selectedCardUpgraded = run.deck.filter(
        card => card.id === normalizedSelectedId && card.isUpgraded
      ).length;
      selectedCardUpgradedCount += selectedCardUpgraded;
      
      // Track all other cards in the deck as pairings
      deckIds.forEach(cardId => {
        if (cardId !== normalizedSelectedId) {
          if (!pairingData[cardId]) {
            const cardData = run.deck.find(c => c.id === cardId);
            const dbCard = cardData?.dbCard || getCardFromDatabase(cardId);
            
            pairingData[cardId] = {
              id: cardId,
              name: cardData?.name || dbCard?.name || cardId.replace(/_/g, ' '),
              appearances: 0,
              wins: 0,
              losses: 0,
              upgradedCount: 0,
              dbCard: dbCard
            };
          }
          
          pairingData[cardId].appearances++;
          if (wasWin) {
            pairingData[cardId].wins++;
          } else {
            pairingData[cardId].losses++;
          }
          
          // Count upgraded copies of the paired card
          const pairedCardUpgraded = run.deck.filter(
            card => card.id === cardId && card.isUpgraded
          ).length;
          pairingData[cardId].upgradedCount += pairedCardUpgraded;
        }
      });
    }
  });
  
  // Calculate win rates and synergy scores
  const pairingsArray = Object.values(pairingData).map(pairing => {
    const winRate = pairing.appearances > 0 ? (pairing.wins / pairing.appearances) * 100 : 0;
    const baseWinRate = selectedCardTotalAppearances > 0 ? (selectedCardWins / selectedCardTotalAppearances) * 100 : 0;
    const synergyScore = winRate - baseWinRate;
    
    return {
      ...pairing,
      winRate,
      synergyPercentage: synergyScore
    };
  });
  
  const selectedCardWinRate = selectedCardTotalAppearances > 0 
    ? (selectedCardWins / selectedCardTotalAppearances) * 100 
    : 0;
  
  const result = {
    pairings: pairingsArray,
    selectedCardStats: {
      appearances: selectedCardTotalAppearances,
      wins: selectedCardWins,
      losses: selectedCardLosses,
      winRate: selectedCardWinRate,
      upgradedCount: selectedCardUpgradedCount
    }
  };
  
  return result;
};