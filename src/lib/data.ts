import { beliefs, categories } from '@/data';
import { Belief, Category, SortOption, FilterStatus } from '@/types/belief.types';

// Type the imported data
const typedBeliefs = beliefs as Belief[];
const typedCategories = categories as Category[];

// Belief data access
export const getAllBeliefs = (): Belief[] => {
  return typedBeliefs;
};

export const getBeliefById = (id: string): Belief | null => {
  const belief = typedBeliefs.find(b => b.id === id);
  return belief || null;
};

export const getBeliefsByCategory = (category: string): Belief[] => {
  return typedBeliefs.filter(b => 
    b.category.toLowerCase() === category.toLowerCase()
  );
};

export const getBeliefsByStatus = (status: FilterStatus): Belief[] => {
  if (status === 'all') return typedBeliefs;
  return typedBeliefs.filter(b => b.status === status);
};

export const searchBeliefs = (query: string): Belief[] => {
  const lowercaseQuery = query.toLowerCase();
  return typedBeliefs.filter(b => 
    b.title.toLowerCase().includes(lowercaseQuery) ||
    b.description.toLowerCase().includes(lowercaseQuery) ||
    b.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
    b.category.toLowerCase().includes(lowercaseQuery) ||
    b.subCategory?.toLowerCase().includes(lowercaseQuery)
  );
};

export const getBeliefsByConsensusLevel = (min: number, max: number): Belief[] => {
  return typedBeliefs.filter(b => 
    b.consensusLevel >= min && b.consensusLevel <= max
  );
};

export const sortBeliefs = (beliefs: Belief[], sortBy: SortOption): Belief[] => {
  switch (sortBy) {
    case 'recent':
      return [...beliefs].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'active':
      return [...beliefs].sort((a, b) => b.participantCount - a.participantCount);
    case 'stakes':
      return [...beliefs].sort((a, b) => b.totalStake - a.totalStake);
    case 'consensus':
      return [...beliefs].sort((a, b) => b.consensusLevel - a.consensusLevel);
    default:
      return beliefs;
  }
};

export const getBeliefsByLayoutType = (layoutType: string): Belief[] => {
  return typedBeliefs.filter(b => b.layoutType === layoutType);
};

export const getBeliefsBySubCategory = (subCategory: string): Belief[] => {
  return typedBeliefs.filter(b => 
    b.subCategory?.toLowerCase() === subCategory.toLowerCase()
  );
};

export const getBeliefsByTags = (tags: string[]): Belief[] => {
  return typedBeliefs.filter(b => 
    b.tags?.some(tag => 
      tags.some(searchTag => 
        tag.toLowerCase().includes(searchTag.toLowerCase())
      )
    )
  );
};

// Category data access
export const getAllCategories = (): Category[] => {
  return typedCategories;
};

export const getCategoryById = (id: string): Category | null => {
  const category = typedCategories.find(c => c.id === id);
  return category || null;
};

export const getCategoryByName = (name: string): Category | null => {
  const category = typedCategories.find(c => 
    c.name.toLowerCase() === name.toLowerCase()
  );
  return category || null;
};

// Combined utilities
export const getBeliefStats = () => {
  const total = typedBeliefs.length;
  const active = typedBeliefs.filter(b => b.status === 'active').length;
  const resolved = typedBeliefs.filter(b => b.status === 'resolved').length;
  const closed = typedBeliefs.filter(b => b.status === 'closed').length;
  
  const totalStake = typedBeliefs.reduce((sum, b) => sum + b.totalStake, 0);
  const totalParticipants = typedBeliefs.reduce((sum, b) => sum + b.participantCount, 0);
  
  const avgConsensus = typedBeliefs.reduce((sum, b) => sum + b.consensusLevel, 0) / total;
  
  return {
    total,
    active,
    resolved,
    closed,
    totalStake,
    totalParticipants,
    avgConsensus: Math.round(avgConsensus * 100) / 100
  };
};

export const getCategoryStats = () => {
  const categoryStats = typedCategories.map(category => ({
    ...category,
    beliefCount: getBeliefsByCategory(category.name).length,
    activeBeliefs: getBeliefsByCategory(category.name).filter(b => b.status === 'active').length,
    totalStake: getBeliefsByCategory(category.name).reduce((sum, b) => sum + b.totalStake, 0)
  }));
  
  return categoryStats;
}; 