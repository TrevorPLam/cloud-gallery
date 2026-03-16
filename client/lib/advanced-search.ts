// Advanced Search Operators implementation for encrypted queries
// Provides AND, OR, NOT operators with encrypted data processing

import { 
  SearchOperator,
  SearchTokenType,
  EncryptedSearchTerm,
  initializeSSE,
  encryptSearchTerm,
  decryptSearchTerm,
  generateTokenId,
  secureWipeSSE
} from "./encrypted-search";
import { 
  EncryptedSearchIndex,
  SearchResult,
  searchEncryptedIndex,
  SearchQuery,
  SearchFilter
} from "./search-index";
import { 
  TokenManager,
  generateBooleanToken,
  validateToken
} from "./search-tokens";

// Advanced search configuration
export const MAX_TERMS_PER_QUERY = 10;
export const MAX_NESTED_OPERATORS = 3;
export const QUERY_TIMEOUT_DEFAULT = 30000; // 30 seconds
export const RESULT_CACHE_SIZE = 100;

// Query node types for complex queries
export enum QueryNodeType {
  TERM = "term",
  AND = "and",
  OR = "or", 
  NOT = "not",
  FILTER = "filter"
}

// Query node interface
export interface QueryNode {
  type: QueryNodeType;
  value?: string; // For TERM nodes
  children?: QueryNode[]; // For operator nodes
  filter?: SearchFilter; // For FILTER nodes
  weight?: number; // For relevance weighting
  encrypted?: boolean; // Whether node is encrypted
}

// Complex query interface
export interface ComplexQuery {
  root: QueryNode;
  queryId: string;
  timestamp: number;
  timeout: number;
  maxResults: number;
  enableRelevanceScoring: boolean;
}

// Query execution plan
export interface QueryExecutionPlan {
  steps: QueryStep[];
  estimatedComplexity: number;
  estimatedResults: number;
  requiresFullScan: boolean;
}

// Query execution step
export interface QueryStep {
  stepId: string;
  operation: string;
  encryptedTerms: string[];
  operators: SearchOperator[];
  estimatedResults: number;
  requiresIndexLookup: boolean;
}

// Advanced search result
export interface AdvancedSearchResult extends SearchResult {
  queryId: string;
  executionTime: number;
  totalResultsProcessed: number;
  relevanceFactors: {
    termMatch: number;
    operatorMatch: number;
    filterMatch: number;
    boost: number;
  };
  debugInfo?: {
    stepsExecuted: number;
    cacheHits: number;
    indexLookups: number;
  };
}

// Query cache entry
export interface QueryCacheEntry {
  queryId: string;
  results: AdvancedSearchResult[];
  timestamp: number;
  executionTime: number;
  hitCount: number;
}

/**
 * Initialize advanced search system
 */
export async function initializeAdvancedSearch(): Promise<void> {
  await initializeSSE();
}

/**
 * Create term query node
 * @param term - Search term
 * @param weight - Optional weight for relevance
 * @returns Term query node
 */
export function createTermNode(term: string, weight: number = 1.0): QueryNode {
  return {
    type: QueryNodeType.TERM,
    value: term,
    weight,
    encrypted: false
  };
}

/**
 * Create AND operator node
 * @param children - Child query nodes
 * @returns AND query node
 */
export function createAndNode(...children: QueryNode[]): QueryNode {
  if (children.length < 2) {
    throw new Error("AND operator requires at least 2 children");
  }
  return {
    type: QueryNodeType.AND,
    children,
    weight: 1.0,
    encrypted: false
  };
}

/**
 * Create OR operator node
 * @param children - Child query nodes
 * @returns OR query node
 */
export function createOrNode(...children: QueryNode[]): QueryNode {
  if (children.length < 2) {
    throw new Error("OR operator requires at least 2 children");
  }
  return {
    type: QueryNodeType.OR,
    children,
    weight: 1.0,
    encrypted: false
  };
}

/**
 * Create NOT operator node
 * @param child - Child query node to negate
 * @returns NOT query node
 */
export function createNotNode(child: QueryNode): QueryNode {
  return {
    type: QueryNodeType.NOT,
    children: [child],
    weight: 1.0,
    encrypted: false
  };
}

/**
 * Create filter node
 * @param filter - Search filter
 * @returns Filter query node
 */
export function createFilterNode(filter: SearchFilter): QueryNode {
  return {
    type: QueryNodeType.FILTER,
    filter,
    weight: 0.5, // Filters typically have lower weight
    encrypted: false
  };
}

/**
 * Build complex query from query string
 * @param queryString - Query string with operators
 * @returns Complex query
 */
export function buildComplexQuery(queryString: string): ComplexQuery {
  try {
    // Parse query string (simplified parser)
    const root = parseQueryString(queryString);
    
    return {
      root,
      queryId: generateTokenId(),
      timestamp: Date.now(),
      timeout: QUERY_TIMEOUT_DEFAULT,
      maxResults: 50,
      enableRelevanceScoring: true
    };

  } catch (error) {
    console.error("Failed to build complex query:", error);
    throw error;
  }
}

/**
 * Parse query string into query nodes
 * @param queryString - Query string to parse
 * @returns Root query node
 */
function parseQueryString(queryString: string): QueryNode {
  try {
    const normalizedQuery = queryString.trim();
    
    // Simple parsing logic - in production, use a proper parser
    if (normalizedQuery.includes(" AND ")) {
      const terms = normalizedQuery.split(" AND ");
      const termNodes = terms.map(term => createTermNode(term.trim()));
      return createAndNode(...termNodes);
    }
    
    if (normalizedQuery.includes(" OR ")) {
      const terms = normalizedQuery.split(" OR ");
      const termNodes = terms.map(term => createTermNode(term.trim()));
      return createOrNode(...termNodes);
    }
    
    if (normalizedQuery.startsWith("NOT ")) {
      const term = normalizedQuery.substring(4).trim();
      return createNotNode(createTermNode(term));
    }
    
    // Default to term node
    return createTermNode(normalizedQuery);

  } catch (error) {
    console.error("Failed to parse query string:", error);
    throw error;
  }
}

/**
 * Encrypt query nodes for secure processing
 * @param node - Query node to encrypt
 * @param sseKey - SSE encryption key
 * @returns Encrypted query node
 */
export async function encryptQueryNode(node: QueryNode, sseKey: string): Promise<QueryNode> {
  try {
    const encryptedNode: QueryNode = { ...node };
    
    switch (node.type) {
      case QueryNodeType.TERM:
        if (node.value) {
          const encryptedTerm = encryptSearchTerm(node.value, sseKey, SearchTokenType.EXACT);
          encryptedNode.value = encryptedTerm.encryptedTerm;
          encryptedNode.encrypted = true;
        }
        break;
        
      case QueryNodeType.AND:
      case QueryNodeType.OR:
      case QueryNodeType.NOT:
        if (node.children) {
          encryptedNode.children = await Promise.all(
            node.children.map(child => encryptQueryNode(child, sseKey))
          );
        }
        break;
        
      case QueryNodeType.FILTER:
        // Filters are not encrypted as they are processed separately
        break;
        
      default:
        throw new Error(`Unsupported query node type: ${node.type}`);
    }
    
    return encryptedNode;

  } catch (error) {
    console.error("Failed to encrypt query node:", error);
    throw error;
  }
}

/**
 * Create execution plan for complex query
 * @param query - Complex query to plan
 * @param index - Search index for analysis
 * @returns Query execution plan
 */
export function createExecutionPlan(query: ComplexQuery, index: EncryptedSearchIndex): QueryExecutionPlan {
  try {
    const steps: QueryStep[] = [];
    let complexity = 0;
    let estimatedResults = 0;
    let requiresFullScan = false;

    // Analyze query and create execution steps
    const analysis = analyzeQueryNode(query.root, index);
    
    steps.push(...analysis.steps);
    complexity += analysis.complexity;
    estimatedResults = Math.max(estimatedResults, analysis.estimatedResults);
    requiresFullScan = requiresFullScan || analysis.requiresFullScan;

    return {
      steps,
      estimatedComplexity: complexity,
      estimatedResults,
      requiresFullScan
    };

  } catch (error) {
    console.error("Failed to create execution plan:", error);
    throw error;
  }
}

/**
 * Analyze query node for execution planning
 * @param node - Query node to analyze
 * @param index - Search index for analysis
 * @returns Analysis results
 */
function analyzeQueryNode(node: QueryNode, index: EncryptedSearchIndex): {
  steps: QueryStep[];
  complexity: number;
  estimatedResults: number;
  requiresFullScan: boolean;
} {
  try {
    const steps: QueryStep[] = [];
    let complexity = 1;
    let estimatedResults = 0;
    let requiresFullScan = false;

    switch (node.type) {
      case QueryNodeType.TERM:
        if (node.value) {
          const step: QueryStep = {
            stepId: generateTokenId(),
            operation: "TERM_LOOKUP",
            encryptedTerms: [node.value],
            operators: [],
            estimatedResults: estimateTermResults(node.value, index),
            requiresIndexLookup: true
          };
          steps.push(step);
          estimatedResults = step.estimatedResults;
          complexity = 1;
        }
        break;

      case QueryNodeType.AND:
        if (node.children) {
          const childAnalyses = node.children.map(child => analyzeQueryNode(child, index));
          
          // AND operations multiply result counts
          estimatedResults = childAnalyses.reduce((product, analysis) => 
            Math.min(product, analysis.estimatedResults), Infinity);
          
          complexity = childAnalyses.reduce((sum, analysis) => sum + analysis.complexity, 0) + 1;
          
          const allSteps = childAnalyses.flatMap(analysis => analysis.steps);
          const andStep: QueryStep = {
            stepId: generateTokenId(),
            operation: "AND_OPERATION",
            encryptedTerms: allSteps.flatMap(step => step.encryptedTerms),
            operators: [SearchOperator.AND],
            estimatedResults,
            requiresIndexLookup: false
          };
          steps.push(...allSteps, andStep);
        }
        break;

      case QueryNodeType.OR:
        if (node.children) {
          const childAnalyses = node.children.map(child => analyzeQueryNode(child, index));
          
          // OR operations add result counts (with deduplication)
          const uniqueTerms = new Set<string>();
          estimatedResults = childAnalyses.reduce((sum, analysis) => {
            const newTerms = analysis.steps.flatMap(step => step.encryptedTerms)
              .filter(term => !uniqueTerms.has(term));
            newTerms.forEach(term => uniqueTerms.add(term));
            return sum + analysis.estimatedResults;
          }, 0);
          
          complexity = childAnalyses.reduce((sum, analysis) => sum + analysis.complexity, 0) + 1;
          
          const allSteps = childAnalyses.flatMap(analysis => analysis.steps);
          const orStep: QueryStep = {
            stepId: generateTokenId(),
            operation: "OR_OPERATION",
            encryptedTerms: Array.from(uniqueTerms),
            operators: [SearchOperator.OR],
            estimatedResults,
            requiresIndexLookup: false
          };
          steps.push(...allSteps, orStep);
        }
        break;

      case QueryNodeType.NOT:
        if (node.children && node.children.length > 0) {
          const childAnalysis = analyzeQueryNode(node.children[0], index);
          
          // NOT operations require full scan for exclusion
          estimatedResults = index.metadata.totalEntries * 0.1; // Estimate 10% match after exclusion
          complexity = childAnalysis.complexity + index.metadata.totalEntries * 0.5;
          requiresFullScan = true;
          
          const notStep: QueryStep = {
            stepId: generateTokenId(),
            operation: "NOT_OPERATION",
            encryptedTerms: childAnalysis.steps.flatMap(step => step.encryptedTerms),
            operators: [SearchOperator.NOT],
            estimatedResults,
            requiresIndexLookup: true
          };
          steps.push(...childAnalysis.steps, notStep);
        }
        break;

      case QueryNodeType.FILTER:
        // Filters are applied after search, don't affect search complexity
        complexity = 0;
        estimatedResults = index.metadata.totalEntries * 0.2; // Estimate 20% match
        break;

      default:
        throw new Error(`Unsupported query node type: ${node.type}`);
    }

    return { steps, complexity, estimatedResults, requiresFullScan };

  } catch (error) {
    console.error("Failed to analyze query node:", error);
    throw error;
  }
}

/**
 * Estimate results for a term
 * @param encryptedTerm - Encrypted search term
 * @param index - Search index
 * @returns Estimated number of results
 */
function estimateTermResults(encryptedTerm: string, index: EncryptedSearchIndex): number {
  try {
    const indexEntry = index.invertedIndex.get(encryptedTerm);
    if (indexEntry) {
      return indexEntry.documentIds.length;
    }
    
    // Estimate based on index statistics
    const avgResultsPerTerm = index.metadata.totalTerms > 0 ? 
      index.metadata.totalEntries / index.metadata.totalTerms : 1;
    
    return Math.ceil(avgResultsPerTerm);

  } catch (error) {
    console.error("Failed to estimate term results:", error);
    return 1;
  }
}

/**
 * Execute complex query on encrypted index
 * @param query - Complex query to execute
 * @param index - Search index to search
 * @param sseKey - SSE encryption key
 * @returns Advanced search results
 */
export async function executeComplexQuery(
  query: ComplexQuery,
  index: EncryptedSearchIndex,
  sseKey: string
): Promise<AdvancedSearchResult[]> {
  try {
    const startTime = Date.now();
    
    // Create execution plan
    const plan = createExecutionPlan(query, index);
    
    // Execute query steps
    const results = await executeQuerySteps(query, plan, index, sseKey);
    
    const executionTime = Date.now() - startTime;
    
    // Enhance results with advanced metadata
    const advancedResults: AdvancedSearchResult[] = results.map((result, index) => ({
      ...result,
      queryId: query.queryId,
      executionTime,
      totalResultsProcessed: results.length,
      relevanceFactors: {
        termMatch: result.relevanceScore * 0.6,
        operatorMatch: result.relevanceScore * 0.3,
        filterMatch: 0.1,
        boost: 1.0
      },
      debugInfo: {
        stepsExecuted: plan.steps.length,
        cacheHits: 0, // TODO: Implement caching
        indexLookups: plan.steps.filter(step => step.requiresIndexLookup).length
      }
    }));

    // Sort by final relevance score
    advancedResults.sort((a, b) => {
      const scoreA = a.relevanceFactors.termMatch + a.relevanceFactors.operatorMatch + 
                   a.relevanceFactors.filterMatch + a.relevanceFactors.boost;
      const scoreB = b.relevanceFactors.termMatch + b.relevanceFactors.operatorMatch + 
                   b.relevanceFactors.filterMatch + b.relevanceFactors.boost;
      return scoreB - scoreA;
    });

    // Limit results
    return advancedResults.slice(0, query.maxResults);

  } catch (error) {
    console.error("Complex query execution failed:", error);
    throw error;
  }
}

/**
 * Execute query steps from execution plan
 * @param query - Original complex query
 * @param plan - Execution plan
 * @param index - Search index
 * @param sseKey - SSE encryption key
 * @returns Search results
 */
async function executeQuerySteps(
  query: ComplexQuery,
  plan: QueryExecutionPlan,
  index: EncryptedSearchIndex,
  sseKey: string
): Promise<SearchResult[]> {
  try {
    let results: SearchResult[] = [];
    let allDocumentIds = new Set<string>();

    // Execute each step in sequence
    for (const step of plan.steps) {
      const stepResults = await executeQueryStep(step, index, sseKey);
      
      // Combine results based on operation
      switch (step.operation) {
        case "TERM_LOOKUP":
          results = stepResults;
          stepResults.forEach(result => allDocumentIds.add(result.documentId));
          break;

        case "AND_OPERATION":
          results = results.filter(result => 
            stepResults.some(stepResult => stepResult.documentId === result.documentId)
          );
          break;

        case "OR_OPERATION":
          const newResults = stepResults.filter(result => !allDocumentIds.has(result.documentId));
          results.push(...newResults);
          stepResults.forEach(result => allDocumentIds.add(result.documentId));
          break;

        case "NOT_OPERATION":
          results = results.filter(result => 
            !stepResults.some(stepResult => stepResult.documentId === result.documentId)
          );
          break;

        default:
          console.warn(`Unknown operation: ${step.operation}`);
      }
    }

    // Apply filters if present
    const filterNode = findFilterNode(query.root);
    if (filterNode && filterNode.filter) {
      results = applyFilters(results, filterNode.filter, index);
    }

    return results;

  } catch (error) {
    console.error("Query step execution failed:", error);
    throw error;
  }
}

/**
 * Execute individual query step
 * @param step - Query step to execute
 * @param index - Search index
 * @param sseKey - SSE encryption key
 * @returns Search results for this step
 */
async function executeQueryStep(
  step: QueryStep,
  index: EncryptedSearchIndex,
  sseKey: string
): Promise<SearchResult[]> {
  try {
    if (!step.requiresIndexLookup) {
      return [];
    }

    const searchQuery: SearchQuery = {
      encryptedTerms: step.encryptedTerms,
      operators: step.operators,
      limit: 1000, // Get more results for processing
      offset: 0
    };

    return await searchEncryptedIndex(index, step.encryptedTerms, searchQuery);

  } catch (error) {
    console.error("Query step execution failed:", error);
    return [];
  }
}

/**
 * Find filter node in query tree
 * @param node - Query node to search
 * @returns Filter node or null
 */
function findFilterNode(node: QueryNode): QueryNode | null {
  if (node.type === QueryNodeType.FILTER) {
    return node;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const filterNode = findFilterNode(child);
      if (filterNode) {
        return filterNode;
      }
    }
  }
  
  return null;
}

/**
 * Apply filters to search results
 * @param results - Search results to filter
 * @param filter - Filter to apply
 * @param index - Search index for document metadata
 * @returns Filtered search results
 */
function applyFilters(
  results: SearchResult[],
  filter: SearchFilter,
  index: EncryptedSearchIndex
): SearchResult[] {
  try {
    return results.filter(result => {
      const documentEntry = index.documentIndex.get(result.documentId);
      if (!documentEntry) {
        return false;
      }

      // Apply date range filter
      if (filter.dateRange) {
        const docTime = documentEntry.timestamp;
        if (docTime < filter.dateRange.start || docTime > filter.dateRange.end) {
          return false;
        }
      }

      // Apply location filter (simplified)
      if (filter.location) {
        // In a real implementation, we'd parse location data and calculate distances
        // For now, we'll assume all documents pass location filter
      }

      // Apply tags filter
      if (filter.tags && filter.tags.length > 0) {
        // In a real implementation, we'd check document tags
        // For now, we'll assume all documents pass tags filter
      }

      // Apply media type filter
      if (filter.mediaType && filter.mediaType.length > 0) {
        // In a real implementation, we'd check document media type
        // For now, we'll assume all documents pass media type filter
      }

      return true;

    });

  } catch (error) {
    console.error("Filter application failed:", error);
    return results; // Return unfiltered results on error
  }
}

/**
 * Optimize complex query for better performance
 * @param query - Complex query to optimize
 * @returns Optimized complex query
 */
export function optimizeComplexQuery(query: ComplexQuery): ComplexQuery {
  try {
    const optimizedRoot = optimizeQueryNode(query.root);
    
    return {
      ...query,
      root: optimizedRoot
    };

  } catch (error) {
    console.error("Query optimization failed:", error);
    return query; // Return original query on error
  }
}

/**
 * Optimize individual query node
 * @param node - Query node to optimize
 * @returns Optimized query node
 */
function optimizeQueryNode(node: QueryNode): QueryNode {
  try {
    switch (node.type) {
      case QueryNodeType.AND:
        // Reorder AND children by selectivity (most selective first)
        if (node.children) {
          const optimizedChildren = node.children
            .map(child => optimizeQueryNode(child))
            .sort((a, b) => (a.weight || 1) - (b.weight || 1));
          return { ...node, children: optimizedChildren };
        }
        break;

      case QueryNodeType.OR:
        // Reorder OR children by selectivity (least selective first for better short-circuiting)
        if (node.children) {
          const optimizedChildren = node.children
            .map(child => optimizeQueryNode(child))
            .sort((a, b) => (b.weight || 1) - (a.weight || 1));
          return { ...node, children: optimizedChildren };
        }
        break;

      case QueryNodeType.NOT:
        // NOT nodes can't be optimized much
        if (node.children) {
          const optimizedChild = optimizeQueryNode(node.children[0]);
          return { ...node, children: [optimizedChild] };
        }
        break;

      case QueryNodeType.TERM:
      case QueryNodeType.FILTER:
        // Term and filter nodes are already optimal
        break;

      default:
        throw new Error(`Unsupported query node type: ${node.type}`);
    }

    return node;

  } catch (error) {
    console.error("Query node optimization failed:", error);
    return node;
  }
}
