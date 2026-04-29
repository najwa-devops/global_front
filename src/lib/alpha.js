/**
 * Invoice OCR Text Extractor
 * 
 * A robust heuristic-based extractor for French invoice/facture OCR text.
 * Does NOT rely on regex as the core strategy.
 * 
 * Extraction Pipeline:
 * 1. preprocessText(text) - Normalize and split into lines
 * 2. detectZones(lines) - Split document into header/body/footer zones
 * 3. classifyLine(line) - Classify each line by content type
 * 4. extractCandidates(lines, zones) - Extract field candidates
 * 5. scoreCandidates(candidates) - Score and rank candidates
 * 6. validateAmounts(ht, tva, ttc) - Validate monetary consistency
 * 7. buildFinalResult(...) - Build final JSON with confidence scores
 * 
 * @author Ayman_Azhar
 * @version 1.1.1
 */

class InvoiceExtractor {
  constructor(options) {
    const constructorOptions = options || {};
    this.lowConfidenceThreshold = 65;
    this.enableDocumentMemory = constructorOptions.enableDocumentMemory !== false;
    this.documentMemory = this.createEmptyDocumentMemory();
    this.documentMemoryLimits = {
      suppliers: constructorOptions.documentMemorySupplierLimit || 80,
      invoicePrefixes: constructorOptions.documentMemoryPrefixLimit || 120,
      iceNumbers: constructorOptions.documentMemoryIceLimit || 200
    };
    this.enableLearnedReranker = constructorOptions.enableLearnedReranker !== false;
    this.learnedRerankerWeights = {
      numeroFacture: {
        bias: -1.2,
        heuristicScore: 3.2,
        zoneHeader: 0.7,
        hasInvoiceKeyword: 1.3,
        hasAdminKeyword: -1.2,
        hasClientKeyword: -1.4,
        looksLikeReference: 1.2,
        hasDigits: 0.8,
        charLengthGood: 0.5,
        linePositionTop: 0.6
      },
      fournisseur: {
        bias: -1.0,
        heuristicScore: 3.0,
        zoneHeader: 0.9,
        supplierKeyword: 1.0,
        supplierAnchor: 1.3,
        hasPhone: -1.1,
        hasAdminKeyword: -1.2,
        goodLength: 0.7,
        linePositionTop: 0.6
      },
      ice: {
        bias: -1.1,
        heuristicScore: 3.0,
        zoneHeader: 0.6,
        zoneBody: 0.2,
        hasTypeKeyword: 1.5,
        hasAdminKeyword: 1.1,
        hasDigits: 1.0,
        charLengthGood: 0.8,
        linePositionTop: 0.5
      },
      dateFacture: {
        bias: -1.1,
        heuristicScore: 3.1,
        validDate: 1.5,
        zoneHeader: 0.5,
        zoneBody: -0.5,
        hasDateKeyword: 1.0,
        badDateContext: -1.0,
        linePositionTop: 0.4
      },
      montantHt: {
        bias: -1.4,
        heuristicScore: 3.1,
        zoneFooter: 0.8,
        hasTypeKeyword: 1.3,
        explicitType: 0.8,
        hasTotalKeyword: 0.5,
        lineItemContext: -1.0,
        reasonableAmount: 0.7
      },
      tva: {
        bias: -1.4,
        heuristicScore: 3.1,
        zoneFooter: 0.8,
        hasTypeKeyword: 1.4,
        explicitType: 0.7,
        decimalAmount: 0.7,
        likelyRate: -1.4,
        reasonableAmount: 0.5
      },
      montantTtc: {
        bias: -1.2,
        heuristicScore: 3.3,
        zoneFooter: 0.8,
        hasTypeKeyword: 1.0,
        explicitType: 0.6,
        payableKeyword: 1.4,
        hasTotalKeyword: 0.7,
        lineItemContext: -1.0,
        reasonableAmount: 0.7
      },
      triplet: {
        bias: -1.1,
        heuristicScore: 3.0,
        consistency: 1.5,
        compactness: 0.8,
        explicitTypes: 0.9,
        payableContext: 1.1,
        lineItemPenalty: -1.0
      }
    };
    this.learnedWeightsSource = "embedded-defaults";

    // Neural network reranker options
    this.enableNeuralReranker = constructorOptions.enableNeuralReranker || false;
    this.neuralReranker = null;
    this.neuralModelPath = constructorOptions.neuralModelPath || './neural-weights';

    if (constructorOptions.learnedRerankerWeights) {
      this.setLearnedRerankerWeights(constructorOptions.learnedRerankerWeights, "constructor");
    } else {
      this.tryLoadLearnedWeightsFromFile(constructorOptions.learnedWeightsPath || "alpha.weights.json");
    }

    if (constructorOptions.documentMemory) {
      this.setDocumentMemory(constructorOptions.documentMemory);
    }

    // Load neural model if enabled
    if (this.enableNeuralReranker) {
      this.initializeNeuralReranker();
    }

    // Invoice-related keywords for detection (lowercase for comparison)
    this.invoiceKeywords = [
     "N°delaFacture", "facture", "factures", "invoice", "facture n", "facture n°",
      "reference", "référence", "ref", "piece", "pièce", "bon",
      "numero", "numéro", "num", "no."
    ];

    // Supplier/company indicators
    this.supplierKeywords = [
      "société", "societe", "company", "ltd", "sar", "sarlu", "sa",
      "etabl", "etablissement", "group", "groupe", "inc", "llc",
      "pharmacie", "pharma", "prefa", "menara", "maroc", "sarl"
    ];

    this.supplierAnchorKeywords = [
      "societe", "société", "sarl", "sa", "sarlu", "pharmacie", "pharma",
      "hotel", "tours", "marjane", "electroplanet", "massar",
      "pneus", "khadamat", "boris", "badout", "jet", "cost", "soremed", "digibay", "gueliz",
      "agafay", "quad", "everest", "decoration", "menara", "prefa",
      "produits", "ailleurs"
    ];

    this.supplierNoiseKeywords = [
      "poids", "lourd", "utilitaires", "industriels", "equilibrage", "tourisme",
      "réglage", "reglage", "vulcanisation", "kilometrage", "kilométrage",
      "designation", "qualite", "tradition"
    ];

    // Keywords that should NOT appear in supplier names (strong penalty)
    this.supplierExcludeKeywords = [
      "facture", "client", "ice", "rc", "if", "cnss", "patente",
      "tel", "telephone", "fax", "gsm", "mobile", "email", "site", "web",
      "tva", "ttc", "ht", "total", "net", "payer", "echeance", "date",
      "adresse", "bp", "bd", "avenue", "route", "rue", "code", "postal",
      "reference", "commande", "bon", "piece", "emetteur", "Ã©metteur",
      "adressee", "adressÃ©", "adressÃ©e", "montants", "designation", "dÃ©signation"
    ];

    this.supplierExcludeKeywords.push("numero");
    this.supplierExcludeKeywords.push("page");
    this.supplierExcludeKeywords.push("nbre");
    this.supplierExcludeKeywords.push("rep");
    this.supplierExcludeKeywords.push("prenom");
    this.supplierExcludeKeywords.push("nom");
    this.supplierExcludeKeywords.push("division");
    this.supplierExcludeKeywords.push("representant");
    this.supplierExcludeKeywords.push("total");
    this.supplierExcludeKeywords.push("totalttc");
    this.supplierExcludeKeywords.push("totalht");
    this.supplierExcludeKeywords.push("designation");
    this.supplierExcludeKeywords.push("description");

    // Date-related keywords
    this.dateKeywords = [
      "date", "daté", "datee", "imprime", "imprimé", "édité", "edité",
      "le", "du", "au", "period", "période", "exercice"
    ];

    // Money-related keywords (lowercase for comparison)
    this.moneyKeywords = {
      ht: ["ht", "h.t", "h.t.", "h-t", "hors taxe", "net ht", "total ht", "totalh-t", "total h-t", "montant ht"],
      tva: ["TVA 20 % ","tva", "t.v.a", "t.v.a.", "taxe", "vat", "tva %", "tva 20"],
      ttc: ["ttc", "t.t.c", "t.t.c.", "toutes taxes", "net ttc", "total ttc", "net a payer", "net à payer", "montant ttc"]
    };

    this.moneyKeywords.ttc.push("montant a payer");
    this.moneyKeywords.ttc.push("montant Ã  payer");
    this.moneyKeywords.ttc.push("total general");
    this.moneyKeywords.ttc.push("total gÃ©nÃ©ral");
    this.moneyKeywords.ht.push("sous-total");
    this.moneyKeywords.ht.push("sous total");
    this.moneyKeywords.ttc.push("total a regler");
    this.moneyKeywords.ttc.push("total à regler");
    this.moneyKeywords.ttc.push("totalnetapayer");
    this.moneyKeywords.ttc.push("total net a payer");
    this.moneyKeywords.ttc.push("total netapayer");
    this.moneyKeywords.ttc.push("netapayer");
    this.moneyKeywords.ttc.push("neta payer");
    this.moneyKeywords.ttc.push("montantapayer");
    this.moneyKeywords.ht.push("sous-total");
    this.moneyKeywords.ht.push("sous total");
    this.moneyKeywords.ht.push("totalhtnet");
    this.moneyKeywords.ht.push("htnet");
    this.moneyKeywords.tva.push("dont tva");
    this.moneyKeywords.tva.push("donttva");
    this.moneyKeywords.tva.push("tva20");
    this.moneyKeywords.tva.push("tva 20%");

    this.invoicePresencePhrases = [
      "arrete la presente facture",
      "arrete la facture actuelle",
      "arreter la facture actuelle",
      "arrÃªtÃ© la presente facture",
      "arrÃªtÃ©e la presente facture",
      "arretee la presente facture",
      "arretee la facture actuelle",
      "la presente facture est arretee",
      "la presente facture est arrÃªtÃ©e",
      "facture arretee a la somme de",
      "facture arrÃªtÃ©e Ã  la somme de",
      "facture arretee a",
      "facture arrÃªtÃ©e Ã "
    ];

    this.payableTotalKeywords = [
      "montant a payer",
      "montant ÃƒÂ  payer",
      "montant à payer",
      "montantapayer",
      "net a payer",
      "net ÃƒÂ  payer",
      "net à payer",
      "netapayer",
      "total net a payer",
      "totalnetapayer",
      "total netapayer",
      "total general",
      "total gÃƒÂ©nÃƒÂ©ral",
      "total a regler",
      "total ÃƒÂ  regler",
      "total à regler"
    ];

    this.applyLearnedTerms(this.loadLearnedTerms(constructorOptions.learnedTerms));

    // Administrative/phone patterns to exclude
    this.excludeKeywords = [
      "ice", "if", "rc", "cnss", "patente", "telephone", "tel", "fax",
      "gsm", "mobile", "email", "site", "web", "adresse", "bp", "bd",
      "avenue", "route", "rue", "place", "code", "postal"
    ];

    // Country phone codes to filter out
    this.phoneCodes = [212, 213, 33, 34, 39, 49, 32, 41, 44];
    this.noisyInvoiceAgent = this.loadNoisyInvoiceAgent();

    // Decimal separators
    this.decimalSeparators = [",", "."];

    // Basic French number words for written totals
    this.frenchUnits = {
      "zero": 0, "zéro": 0,
      "un": 1, "une": 1,
      "deux": 2,
      "trois": 3,
      "quatre": 4,
      "cinq": 5,
      "six": 6,
      "sept": 7,
      "huit": 8,
      "neuf": 9,
      "dix": 10,
      "onze": 11,
      "douze": 12,
      "treize": 13,
      "quatorze": 14,
      "quinze": 15,
      "seize": 16
    };

    this.frenchTens = {
      "vingt": 20,
      "trente": 30,
      "quarante": 40,
      "cinquante": 50,
      "soixante": 60
    };

    this.frenchCompactNumberParts = [
      "millions",
      "million",
      "mille",
      "soixante",
      "vingts",
      "cinquante",
      "quarante",
      "trente",
      "vingt",
      "seize",
      "quinze",
      "quatorze",
      "treize",
      "douze",
      "onze",
      "dix",
      "cents",
      "cent",
      "quatre",
      "trois",
      "deux",
      "huit",
      "sept",
      "cinq",
      "neuf",
      "six",
      "une",
      "un",
      "et"
    ];
  }

  /**
   * Main extraction entry point
   * @param {string} text - Raw OCR text
   * @param {object} options - Optional flags such as includeFeatures/includeDiagnostics
   * @returns {object} Extracted invoice data with confidence scores
   */
  extract(text, options) {
    const extractOptions = options || {};

    // Step 1: Preprocess
    const preprocessed = this.preprocessText(text);
    
    // Step 2: Detect zones
    const zones = this.detectZones(preprocessed.lines);
    const blocks = this.buildBlocks(preprocessed.lines, zones);
    
    // Step 3: Classify lines
    const classifiedLines = this.classifyLines(preprocessed.lines);
    
    // Step 4: Extract candidates
    const candidates = this.extractCandidates(text, preprocessed.lines, zones, classifiedLines, blocks);
    
    // Step 5: Score candidates
    const scoredCandidates = this.scoreCandidates(candidates, zones);
    
    // Step 6: Validate amounts
    const validatedAmounts = this.validateAmounts(scoredCandidates, classifiedLines);
    
    // Step 7: Build final result
    const result = this.buildFinalResult(validatedAmounts, scoredCandidates, classifiedLines, zones);

    if (extractOptions.includeFeatures || extractOptions.includeDiagnostics) {
      result.features = this.buildFeatureSnapshot(
        preprocessed,
        zones,
        classifiedLines,
        scoredCandidates,
        validatedAmounts,
        result
      );
    }

    if (extractOptions.includeDiagnostics) {
      result.diagnostics = this.buildDiagnosticsSnapshot(
        preprocessed,
        zones,
        classifiedLines,
        candidates,
        scoredCandidates,
        validatedAmounts
      );
    }

    return result;
  }

  buildTrainingExample(text, expectedLabels) {
    const output = this.extract(text, { includeFeatures: true });
    return {
      text: text || "",
      expectedLabels: expectedLabels || null,
      prediction: {
        numeroFacture: output.numeroFacture,
        fournisseur: output.fournisseur,
        ice: output.ice,
        dateFacture: output.dateFacture,
        montantHt: output.montantHt,
        tva: output.tva,
        montantTtc: output.montantTtc
      },
      confidence: output.confidence,
      missingFields: output.missingFields || [],
      lowConfidenceFields: output.lowConfidenceFields || [],
      reviewRecommended: !!output.reviewRecommended,
      validationNotes: output.validationNotes || [],
      features: output.features
    };
  }

  setLearnedRerankerWeights(weights, sourceLabel) {
    if (!weights || typeof weights !== "object") return;
    this.learnedRerankerWeights = this.deepMergeWeightMaps(this.learnedRerankerWeights, weights);
    this.learnedWeightsSource = sourceLabel || "custom";
  }

  async initializeNeuralReranker() {
    if (!this.enableNeuralReranker) return;

    try {
      const { NeuralReranker } = require('./alpha.js');
      this.neuralReranker = new NeuralReranker(30, [
        'numeroFacture', 'fournisseur', 'ice', 'dateFacture',
        'montantHt', 'tva', 'montantTtc'
      ]);

      // Try to load pre-trained models
      const loaded = await this.neuralReranker.loadModels(this.neuralModelPath);
      if (loaded) {
        console.log('Neural reranker models loaded successfully');
      } else {
        console.log('Neural reranker initialized (models will be trained on first use)');
      }
    } catch (error) {
      console.warn('Could not initialize neural reranker:', error.message);
      this.neuralReranker = null;
    }
  }

  async loadNeuralModel(modelPath) {
    if (!this.neuralReranker) {
      await this.initializeNeuralReranker();
    }
    if (this.neuralReranker && modelPath) {
      return await this.neuralReranker.loadModels(modelPath);
    }
    return false;
  }

  async trainNeuralReranker(trainingData, options = {}) {
    if (!this.neuralReranker) {
      await this.initializeNeuralReranker();
    }
    if (!this.neuralReranker) {
      throw new Error('Neural reranker not available. Install @tensorflow/tfjs-node');
    }

    const { epochs = 50, batchSize = 16, savePath = null } = options;

    console.log('Training neural reranker...');
    const results = await this.neuralReranker.train(trainingData, { epochs, batchSize });

    if (savePath) {
      await this.neuralReranker.saveModels(savePath);
    }

    return results;
  }

  tryLoadLearnedWeightsFromFile(filePath) {
    if (typeof require === "undefined") return false;

    try {
      const fs = require("fs");
      const path = require("path");
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(__dirname, filePath);

      if (!fs.existsSync(resolvedPath)) return false;

      const raw = fs.readFileSync(resolvedPath, "utf8");
      const parsed = JSON.parse(raw);
      this.setLearnedRerankerWeights(parsed, resolvedPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  deepMergeWeightMaps(base, override) {
    const result = {};
    const keys = {};

    for (const key in base) keys[key] = true;
    for (const key in override) keys[key] = true;

    for (const key in keys) {
      const baseValue = base ? base[key] : undefined;
      const overrideValue = override ? override[key] : undefined;

      if (baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)) {
        result[key] = this.deepMergeWeightMaps(baseValue, overrideValue || {});
      } else if (typeof overrideValue !== "undefined") {
        result[key] = overrideValue;
      } else {
        result[key] = baseValue;
      }
    }

    return result;
  }

  buildLabeledTrainingRows(text, expectedLabels) {
    const labels = expectedLabels || {};
    const preprocessed = this.preprocessText(text);
    const zones = this.detectZones(preprocessed.lines);
    const blocks = this.buildBlocks(preprocessed.lines, zones);
    const classifiedLines = this.classifyLines(preprocessed.lines);
    const candidates = this.extractCandidates(text, preprocessed.lines, zones, classifiedLines, blocks);
    const scoredCandidates = this.scoreCandidates(candidates, zones);

    return {
      source: {
        text: text || "",
        expectedLabels: labels
      },
      weightsSource: this.learnedWeightsSource,
      rows: {
        numeroFacture: this.buildFieldTrainingRows(scoredCandidates.numeroFacture, "numeroFacture", labels.numeroFacture),
        fournisseur: this.buildFieldTrainingRows(scoredCandidates.fournisseur, "fournisseur", labels.fournisseur),
        ice: this.buildFieldTrainingRows(scoredCandidates.ice, "ice", labels.ice),
        dateFacture: this.buildFieldTrainingRows(scoredCandidates.dateFacture, "dateFacture", labels.dateFacture),
        montantHt: this.buildFieldTrainingRows(scoredCandidates.money ? scoredCandidates.money.ht : [], "montantHt", labels.montantHt),
        tva: this.buildFieldTrainingRows(scoredCandidates.money ? scoredCandidates.money.tva : [], "tva", labels.tva),
        montantTtc: this.buildFieldTrainingRows(scoredCandidates.money ? scoredCandidates.money.ttc : [], "montantTtc", labels.montantTtc),
        triplet: this.buildTripletTrainingRows(scoredCandidates.money ? scoredCandidates.money.triplets : [], labels)
      }
    };
  }

  buildFieldTrainingRows(candidates, fieldName, expectedValue) {
    const list = candidates || [];
    const rows = [];

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      rows.push({
        field: fieldName,
        label: this.isExpectedFieldMatch(fieldName, candidate ? candidate.value : null, expectedValue) ? 1 : 0,
        value: candidate ? candidate.value : null,
        score: candidate ? this.normalizeConfidence(candidate.score) : 0,
        heuristicScore: candidate ? this.normalizeConfidence(candidate.heuristicScore || candidate.score) : 0,
        mlScore: candidate ? this.normalizeConfidence(candidate.mlScore || 0) : 0,
        features: candidate && candidate.mlFeatures ? candidate.mlFeatures : this.buildRerankerFeatures(candidate, fieldName)
      });
    }

    return rows;
  }

  buildTripletTrainingRows(triplets, expectedLabels) {
    const list = triplets || [];
    const labels = expectedLabels || {};
    const rows = [];

    for (let i = 0; i < list.length; i++) {
      const triplet = list[i];
      const matches =
        this.valuesRoughlyEqual(triplet && triplet.ht ? triplet.ht.value : null, labels.montantHt) &&
        this.valuesRoughlyEqual(triplet && triplet.tva ? triplet.tva.value : null, labels.tva) &&
        this.valuesRoughlyEqual(triplet && triplet.ttc ? triplet.ttc.value : null, labels.montantTtc);

      rows.push({
        field: "triplet",
        label: matches ? 1 : 0,
        score: triplet ? this.normalizeConfidence(triplet.score) : 0,
        heuristicScore: triplet ? this.normalizeConfidence(triplet.heuristicScore || triplet.score) : 0,
        mlScore: triplet ? this.normalizeConfidence(triplet.mlScore || 0) : 0,
        values: {
          ht: triplet && triplet.ht ? triplet.ht.value : null,
          tva: triplet && triplet.tva ? triplet.tva.value : null,
          ttc: triplet && triplet.ttc ? triplet.ttc.value : null
        },
        features: triplet && triplet.mlFeatures ? triplet.mlFeatures : this.buildTripletRerankerFeatures(triplet)
      });
    }

    return rows;
  }

  isExpectedFieldMatch(fieldName, candidateValue, expectedValue) {
    if (typeof expectedValue === "undefined" || expectedValue === null || expectedValue === "") {
      return false;
    }

    if (fieldName === "montantHt" || fieldName === "tva" || fieldName === "montantTtc") {
      return this.valuesRoughlyEqual(candidateValue, expectedValue);
    }

    if (fieldName === "ice") {
      return this.normalizeComparableText(candidateValue) === this.normalizeComparableText(expectedValue);
    }

    return this.normalizeComparableText(candidateValue) === this.normalizeComparableText(expectedValue);
  }

  valuesRoughlyEqual(a, b) {
    const left = typeof a === "number" ? a : parseFloat(a);
    const right = typeof b === "number" ? b : parseFloat(b);

    if (isNaN(left) || isNaN(right)) return false;
    return Math.abs(left - right) < 0.01;
  }

  normalizeComparableText(value) {
    const text = this.toLowerCaseSafe(String(value || ""));
    let result = "";

    for (let i = 0; i < text.length; i++) {
      const char = this.normalizeFrenchChar(text[i]);
      const code = char.charCodeAt(0);
      const isLetter = (code >= 97 && code <= 122);
      const isDigit = (code >= 48 && code <= 57);
      if (isLetter || isDigit) {
        result += char;
      }
    }

    return result;
  }

  loadLearnedTerms(explicitTerms) {
    if (explicitTerms && typeof explicitTerms === "object") {
      return explicitTerms;
    }

    if (typeof window !== "undefined" && window.AlphaLearn && typeof window.AlphaLearn === "object") {
      return window.AlphaLearn;
    }

    if (typeof globalThis !== "undefined" && globalThis.AlphaLearn && typeof globalThis.AlphaLearn === "object") {
      return globalThis.AlphaLearn;
    }

    if (typeof require !== "undefined") {
      try {
        // return require("./learn.js"); // Module not found during build - using fallback instead
        return null;
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  applyLearnedTerms(terms) {
    if (!terms || typeof terms !== "object") return;

    if (terms.moneyKeywords && typeof terms.moneyKeywords === "object") {
      if (Array.isArray(terms.moneyKeywords.ht)) {
        this.mergeLearnedList(this.moneyKeywords.ht, terms.moneyKeywords.ht);
      }
      if (Array.isArray(terms.moneyKeywords.tva)) {
        this.mergeLearnedList(this.moneyKeywords.tva, terms.moneyKeywords.tva);
      }
      if (Array.isArray(terms.moneyKeywords.ttc)) {
        this.mergeLearnedList(this.moneyKeywords.ttc, terms.moneyKeywords.ttc);
      }
    }

    if (Array.isArray(terms.invoiceKeywords)) {
      this.mergeLearnedList(this.invoiceKeywords, terms.invoiceKeywords);
    }
    if (Array.isArray(terms.supplierKeywords)) {
      this.mergeLearnedList(this.supplierKeywords, terms.supplierKeywords);
    }
    if (Array.isArray(terms.supplierAnchorKeywords)) {
      this.mergeLearnedList(this.supplierAnchorKeywords, terms.supplierAnchorKeywords);
    }
    if (Array.isArray(terms.invoicePresencePhrases)) {
      this.mergeLearnedList(this.invoicePresencePhrases, terms.invoicePresencePhrases);
    }
    if (Array.isArray(terms.payableTotalKeywords)) {
      this.mergeLearnedList(this.payableTotalKeywords, terms.payableTotalKeywords);
      this.mergeLearnedList(this.moneyKeywords.ttc, terms.payableTotalKeywords);
    }
    if (Array.isArray(terms.frenchCompactNumberParts)) {
      this.mergeLearnedList(this.frenchCompactNumberParts, terms.frenchCompactNumberParts);
    }
  }

  mergeLearnedList(target, additions) {
    if (!Array.isArray(target) || !Array.isArray(additions)) return;

    for (let i = 0; i < additions.length; i++) {
      const rawValue = additions[i];
      if (typeof rawValue !== "string") continue;
      const value = this.trimSafe(rawValue);
      if (!value) continue;
      if (!this.arrayContainsExactValue(target, value)) {
        target.push(value);
      }
    }
  }

  createEmptyDocumentMemory() {
    return {
      seenDocuments: 0,
      suppliers: {},
      invoicePrefixes: {},
      iceNumbers: {},
      lastUpdatedAt: 0
    };
  }

  setDocumentMemory(memory) {
    if (!memory || typeof memory !== "object") return;

    const nextMemory = this.createEmptyDocumentMemory();
    nextMemory.seenDocuments = typeof memory.seenDocuments === "number" ? memory.seenDocuments : 0;
    nextMemory.lastUpdatedAt = typeof memory.lastUpdatedAt === "number" ? memory.lastUpdatedAt : 0;
    nextMemory.suppliers = memory.suppliers && typeof memory.suppliers === "object" ? memory.suppliers : {};
    nextMemory.invoicePrefixes = memory.invoicePrefixes && typeof memory.invoicePrefixes === "object" ? memory.invoicePrefixes : {};
    nextMemory.iceNumbers = memory.iceNumbers && typeof memory.iceNumbers === "object" ? memory.iceNumbers : {};
    this.documentMemory = nextMemory;
  }

  exportDocumentMemory() {
    return JSON.parse(JSON.stringify(this.documentMemory || this.createEmptyDocumentMemory()));
  }

  getDocumentMemoryStats() {
    const memory = this.documentMemory || this.createEmptyDocumentMemory();
    return {
      seenDocuments: memory.seenDocuments || 0,
      supplierCount: Object.keys(memory.suppliers || {}).length,
      invoicePrefixCount: Object.keys(memory.invoicePrefixes || {}).length,
      iceCount: Object.keys(memory.iceNumbers || {}).length,
      lastUpdatedAt: memory.lastUpdatedAt || 0
    };
  }

  learnFromExtractionResult(result) {
    if (!this.enableDocumentMemory || !result) return;

    const memory = this.documentMemory || this.createEmptyDocumentMemory();
    const supplierKey = this.normalizeComparableText(result.fournisseur || "");
    const invoicePrefix = this.extractInvoicePrefix(result.numeroFacture || "");
    const dateFormat = this.extractDateFormatSignature(result.dateFacture || "");
    const iceValues = Array.isArray(result.ice) ? result.ice : [];

    if (supplierKey) {
      const supplierEntry = memory.suppliers[supplierKey] || {
        displayName: result.fournisseur || "",
        count: 0,
        iceNumbers: {},
        invoicePrefixes: {},
        dateFormats: {}
      };

      supplierEntry.displayName = result.fournisseur || supplierEntry.displayName || "";
      supplierEntry.count += 1;

      for (let i = 0; i < iceValues.length; i++) {
        const iceValue = this.extractDigitsOnly(iceValues[i] || "");
        if (!iceValue) continue;
        supplierEntry.iceNumbers[iceValue] = (supplierEntry.iceNumbers[iceValue] || 0) + 1;
      }

      if (invoicePrefix) {
        supplierEntry.invoicePrefixes[invoicePrefix] = (supplierEntry.invoicePrefixes[invoicePrefix] || 0) + 1;
      }

      if (dateFormat) {
        supplierEntry.dateFormats[dateFormat] = (supplierEntry.dateFormats[dateFormat] || 0) + 1;
      }

      memory.suppliers[supplierKey] = supplierEntry;
    }

    if (invoicePrefix) {
      const prefixEntry = memory.invoicePrefixes[invoicePrefix] || {
        count: 0,
        suppliers: {}
      };
      prefixEntry.count += 1;
      if (supplierKey) {
        prefixEntry.suppliers[supplierKey] = (prefixEntry.suppliers[supplierKey] || 0) + 1;
      }
      memory.invoicePrefixes[invoicePrefix] = prefixEntry;
    }

    for (let i = 0; i < iceValues.length; i++) {
      const iceValue = this.extractDigitsOnly(iceValues[i] || "");
      if (!iceValue) continue;

      const iceEntry = memory.iceNumbers[iceValue] || {
        count: 0,
        suppliers: {}
      };
      iceEntry.count += 1;
      if (supplierKey) {
        iceEntry.suppliers[supplierKey] = (iceEntry.suppliers[supplierKey] || 0) + 1;
      }
      memory.iceNumbers[iceValue] = iceEntry;
    }

    memory.seenDocuments = (memory.seenDocuments || 0) + 1;
    memory.lastUpdatedAt = Date.now();
    this.pruneDocumentMemory(memory);
    this.documentMemory = memory;
  }

  pruneDocumentMemory(memory) {
    if (!memory) return;
    this.pruneMemoryMap(memory.suppliers, this.documentMemoryLimits.suppliers);
    this.pruneMemoryMap(memory.invoicePrefixes, this.documentMemoryLimits.invoicePrefixes);
    this.pruneMemoryMap(memory.iceNumbers, this.documentMemoryLimits.iceNumbers);
  }

  pruneMemoryMap(map, limit) {
    if (!map || typeof map !== "object") return;
    const keys = Object.keys(map);
    if (keys.length <= limit) return;

    keys.sort((left, right) => {
      const leftCount = map[left] && typeof map[left].count === "number" ? map[left].count : 0;
      const rightCount = map[right] && typeof map[right].count === "number" ? map[right].count : 0;
      return rightCount - leftCount;
    });

    for (let i = limit; i < keys.length; i++) {
      delete map[keys[i]];
    }
  }

  extractInvoicePrefix(reference) {
    const normalized = this.normalizeReferenceToken(reference || "");
    if (!normalized) return "";

    let prefix = "";
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const code = char.charCodeAt(0);
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      if (!isLetter) break;
      prefix += this.toLowerCaseSafe(char);
    }

    if (prefix.length >= 2) return prefix;

    const slashIndex = normalized.indexOf("/");
    if (slashIndex > 0) {
      return this.normalizeComparableText(normalized.slice(0, slashIndex)).slice(0, 8);
    }

    return this.normalizeComparableText(normalized).slice(0, 8);
  }

  extractDateFormatSignature(value) {
    const text = String(value || "");
    if (!text) return "";
    if (this.containsSubstring(text, "-")) return "dd-mm-yyyy";
    if (this.containsSubstring(text, "/")) return "dd/mm/yyyy";
    if (this.containsSubstring(text, ".")) return "dd.mm.yyyy";
    return "";
  }

  getSupplierMemoryProfile(value) {
    const key = this.normalizeComparableText(value || "");
    if (!key || !this.documentMemory || !this.documentMemory.suppliers) return null;
    return this.documentMemory.suppliers[key] || null;
  }

  computeSupplierMemoryBoost(candidate) {
    if (!this.enableDocumentMemory || !candidate) return 0;
    const profile = this.getSupplierMemoryProfile(candidate.value || "");
    if (!profile) return 0;

    const count = profile.count || 0;
    if (count <= 0) return 0;
    return Math.min(18, 4 + (count * 2));
  }

  computeInvoiceMemoryBoost(candidate) {
    if (!this.enableDocumentMemory || !candidate) return 0;
    const prefix = this.extractInvoicePrefix(candidate.value || "");
    if (!prefix || !this.documentMemory || !this.documentMemory.invoicePrefixes) return 0;

    const profile = this.documentMemory.invoicePrefixes[prefix];
    if (!profile || !profile.count) return 0;
    return Math.min(14, 3 + (profile.count * 2));
  }

  computeIceMemoryBoost(candidate) {
    if (!this.enableDocumentMemory || !candidate) return 0;
    const value = this.extractDigitsOnly(candidate.value || "");
    if (!value || !this.documentMemory || !this.documentMemory.iceNumbers) return 0;

    const profile = this.documentMemory.iceNumbers[value];
    if (!profile || !profile.count) return 0;
    return Math.min(18, 4 + (profile.count * 2));
  }

  computeDateMemoryBoost(candidate) {
    if (!this.enableDocumentMemory || !candidate) return 0;
    const format = this.extractDateFormatSignature(candidate.value || "");
    if (!format || !this.documentMemory || !this.documentMemory.suppliers) return 0;

    let best = 0;
    const suppliers = this.documentMemory.suppliers;
    const keys = Object.keys(suppliers);
    for (let i = 0; i < keys.length; i++) {
      const profile = suppliers[keys[i]];
      if (!profile || !profile.dateFormats || !profile.dateFormats[format]) continue;
      best = Math.max(best, profile.dateFormats[format]);
    }

    if (best <= 0) return 0;
    return Math.min(8, 2 + best);
  }

  computeSupplierIceCompatibilityBoost(supplierValue, iceValues) {
    if (!this.enableDocumentMemory || !supplierValue || !iceValues || iceValues.length === 0) return 0;
    const profile = this.getSupplierMemoryProfile(supplierValue);
    if (!profile || !profile.iceNumbers) return 0;

    let best = 0;
    for (let i = 0; i < iceValues.length; i++) {
      const iceValue = this.extractDigitsOnly(iceValues[i] || "");
      if (!iceValue) continue;
      best = Math.max(best, profile.iceNumbers[iceValue] || 0);
    }

    if (best <= 0) return 0;
    return Math.min(20, 5 + (best * 3));
  }

  computeSupplierInvoiceCompatibilityBoost(supplierValue, invoiceValue) {
    if (!this.enableDocumentMemory || !supplierValue || !invoiceValue) return 0;
    const profile = this.getSupplierMemoryProfile(supplierValue);
    const prefix = this.extractInvoicePrefix(invoiceValue);
    if (!profile || !prefix || !profile.invoicePrefixes) return 0;

    const seen = profile.invoicePrefixes[prefix] || 0;
    if (seen <= 0) return 0;
    return Math.min(14, 4 + (seen * 2));
  }

  // =========================================================================
  // STEP 1: PREPROCESSING
  // =========================================================================

  /**
   * Normalize and prepare text for analysis
   * - Normalize whitespace
   * - Split into lines
   * - Clean obvious OCR noise
   * - Preserve original content for reference
   */
  preprocessText(text) {
    if (!text || typeof text !== 'string') {
      return { lines: [], original: text };
    }

    // Split by newlines (handle \r\n, \n, \r)
    const rawLines = text.split(/\r?\n|\r/);
    
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];

      // Normalize common OCR/mojibake artifacts before analysis
      line = this.normalizeOcrLine(line);
      
      // Normalize multiple spaces to single space
      line = this.normalizeSpaces(line);
      
      // Trim but preserve meaningful content
      line = this.trimSafe(line);
      
      // Skip empty lines
      if (line.length === 0) continue;

      const trust = this.assessLineTrust(line);
      if (trust.skip) continue;
      
      lines.push({
        original: rawLines[i],
        cleaned: line,
        index: i,
        tokens: this.tokenize(line),
        trustScore: trust.score,
        trustFlags: trust.flags,
        lowTrust: trust.score < 50
      });
    }

    return { lines, original: text };
  }

  normalizeOcrLine(str) {
    if (!str) return str;

    const replacements = [
      ["R\\.?C\\.?\\?:", "RC:"],
      ["R\\.?C\\.:", "RC:"],
      ["I\\.?F\\.?\\?:", "IF:"],
      ["I\\.?F\\.:", "IF:"],
      ["T\\.?P\\.?", "TP"],
      ["NÂ°", "N°"],
      // UTF-8 mojibake (double-encoded) - most common patterns
      ["Ã©", "é"],
      ["Ã¨", "è"],
      ["Ãª", "ê"],
      ["Ã«", "ë"],
      ["Ã ", "à"],
      ["Ã¢", "â"],
      ["Ã§", "ç"],
      ["Ã¹", "ù"],
      ["Ã»", "û"],
      ["Ã®", "î"],
      ["Ã¯", "ï"],
      ["Ã´", "ô"],
      ["Ã¶", "ö"],
      ["Ãœ", "Ü"],
      ["Ã¼", "ü"],
      ["ÃŸ", "ß"],
      ["Ã‰", "É"],
      ["ÃŠ", "Ê"],
      ["Ã‹", "Ë"],
      ["Ã€", "À"],
      ["Ã¡", "á"],
      ["Ã¡", "á"],
      ["Ã³", "ó"],
      ["Ãº", "ú"],
      ["Ã½", "ý"],
      ["Ã±", "ñ"],
      // Common multi-char mojibake patterns
      ["ÃƒÂ©", "é"],
      ["ÃƒÂ¨", "è"],
      ["ÃƒÂ ", "à"],
      ["ÃƒÂª", "ê"],
      ["ÃƒÂ§", "ç"],
      ["ÃƒÂ‰", "É"],
      ["ÃƒÂ€", "À"],
      // Artifacts from PDF/text extraction
      ["Â©", ""],
      ["Â ", " "],
      ["Â·", ""],
      ["â€œ", "\""],
      ["â€", "\""],
      ["â€˜", "'"],
      ["â€™", "'"],
      ["â€š", ","],
      ["â€", "-"],
      ["â€", "-"],
      ["â€¦", "..."],
      ["Â", ""],
      ["\t", " "],
      ["\\", " "],
      // Common OCR confusions
      ["0", "0"],
      ["1", "1"],
      ["l", "l"]
    ];

    let result = str;
    for (let i = 0; i < replacements.length; i++) {
      result = this.replaceAllSafe(result, replacements[i][0], replacements[i][1]);
    }

    result = this.removeNoiseRuns(result);
    return result;
  }

  replaceAllSafe(str, find, replacement) {
    if (!str || !find || str.length < find.length) return str;

    let result = "";
    let i = 0;
    while (i < str.length) {
      let match = true;
      if (i + find.length <= str.length) {
        for (let j = 0; j < find.length; j++) {
          if (str[i + j] !== find[j]) {
            match = false;
            break;
          }
        }
      } else {
        match = false;
      }

      if (match) {
        result += replacement;
        i += find.length;
      } else {
        result += str[i];
        i++;
      }
    }

    return result;
  }

  removeNoiseRuns(str) {
    let result = "";
    let lastWasNoise = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const code = char.charCodeAt(0);
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const isDigit = code >= 48 && code <= 57;
      const isBasicPunct = char === ' ' || char === ':' || char === '/' || char === '-' ||
        char === '.' || char === ',' || char === '(' || char === ')' || char === '%' ||
        char === '\'' || char === '"' || char === '&';

      if (isLetter || isDigit || isBasicPunct || this.isLikelyAccentChar(char)) {
        result += char;
        lastWasNoise = false;
      } else if (!lastWasNoise) {
        result += ' ';
        lastWasNoise = true;
      }
    }

    return result;
  }

  isLikelyAccentChar(char) {
    return char === 'à' || char === 'â' || char === 'ä' ||
      char === 'ç' ||
      char === 'è' || char === 'é' || char === 'ê' || char === 'ë' ||
      char === 'î' || char === 'ï' ||
      char === 'ô' || char === 'ö' ||
      char === 'ù' || char === 'û' || char === 'ü' ||
      char === 'À' || char === 'Â' || char === 'Ä' ||
      char === 'Ç' ||
      char === 'È' || char === 'É' || char === 'Ê' || char === 'Ë' ||
      char === 'Î' || char === 'Ï' ||
      char === 'Ô' || char === 'Ö' ||
      char === 'Ù' || char === 'Û' || char === 'Ü' ||
      char === '°';
  }

  assessLineTrust(line) {
    const flags = [];
    const lower = this.toLowerCaseSafe(line);
    let score = 100;
    const tokens = this.tokenize(line);

    if (this.isSeparatorLine(line)) {
      return { score: 0, skip: true, flags: ["separator"] };
    }

    if (this.containsSubstring(lower, "[page")) {
      return { score: 0, skip: true, flags: ["page marker"] };
    }

    if (this.containsSubstring(lower, "camscanner") || this.containsSubstring(lower, "scann")) {
      return { score: 0, skip: true, flags: ["scanner watermark"] };
    }

    const letters = this.countLetters(line);
    const digits = this.countDigits(line);
    const symbolCount = this.countSymbols(line);
    const alphaNum = letters + digits;
    const hasStrongKeyword = this.containsAnyKeyword(lower, this.invoiceKeywords) ||
      this.containsAnyKeyword(lower, this.dateKeywords) ||
      this.containsAnyKeyword(lower, this.moneyKeywords.ht) ||
      this.containsAnyKeyword(lower, this.moneyKeywords.tva) ||
      this.containsAnyKeyword(lower, this.moneyKeywords.ttc) ||
      this.containsSubstring(lower, "client") ||
      this.containsSubstring(lower, "arr") ||
      this.containsSubstring(lower, "somme");

    if (this.containsAnyKeyword(lower, this.excludeKeywords)) {
      score -= 25;
      flags.push("admin keywords");
    }

    if (this.containsEmailPattern(line)) {
      score -= 35;
      flags.push("email/web");
    }

    if (this.containsPhonePattern(line)) {
      score -= 25;
      flags.push("phone pattern");
    }

    if (alphaNum > 0) {
      const symbolRatio = symbolCount / (alphaNum + symbolCount);
      if (symbolRatio > 0.35) {
        score -= 35;
        flags.push("high symbol ratio");
      } else if (symbolRatio > 0.20) {
        score -= 15;
        flags.push("moderate symbol ratio");
      }

      const digitRatio = digits / alphaNum;
      if (digitRatio > 0.65) {
        score -= 25;
        flags.push("digit heavy");
      }
    }

    if (line.length <= 3) {
      score -= 40;
      flags.push("very short line");
    } else if (line.length <= 6 && letters < 3) {
      score -= 30;
      flags.push("short fragment");
    }

    let shortTokenCount = 0;
    let singleCharTokenCount = 0;
    let maxTokenLength = 0;
    let moneyLikeTokenCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].length <= 2) shortTokenCount++;
      if (tokens[i].length === 1) singleCharTokenCount++;
      if (tokens[i].length > maxTokenLength) maxTokenLength = tokens[i].length;
      if (this.looksLikeMoney(tokens[i])) moneyLikeTokenCount++;
    }

    if (!hasStrongKeyword && tokens.length > 0) {
      if (shortTokenCount >= Math.ceil(tokens.length * 0.6)) {
        score -= 25;
        flags.push("fragmented tokens");
      }

      if (singleCharTokenCount >= Math.ceil(tokens.length * 0.4)) {
        score -= 20;
        flags.push("many single-char tokens");
      }

      if (tokens.length <= 4 && digits > 0 && letters <= 6) {
        score -= 20;
        flags.push("small mixed OCR fragment");
      }

      if (tokens.length <= 4 && maxTokenLength <= 4 && line.length < 18) {
        score -= 35;
        flags.push("all-short tokens");
      }

      if (moneyLikeTokenCount === 1 && letters <= 8 && tokens.length <= 4) {
        score -= 25;
        flags.push("orphan money token");
      }
    }

    if (letters === 0 && digits === 0) {
      score -= 50;
      flags.push("no alphanumeric content");
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      skip: false,
      flags
    };
  }

  /**
   * Normalize spaces without regex
   */
  normalizeSpaces(str) {
    let result = "";
    let lastWasSpace = false;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const isSpace = char === ' ' || char === '\t';
      
      if (isSpace) {
        if (!lastWasSpace) {
          result += ' ';
          lastWasSpace = true;
        }
      } else {
        result += char;
        lastWasSpace = false;
      }
    }
    
    return result;
  }

  /**
   * Safe trim without regex
   */
  trimSafe(str) {
    let start = 0;
    let end = str.length - 1;
    
    while (start <= end && (str[start] === ' ' || str[start] === '\t')) {
      start++;
    }
    
    while (end >= start && (str[end] === ' ' || str[end] === '\t')) {
      end--;
    }
    
    if (start > end) return "";
    
    let result = "";
    for (let i = start; i <= end; i++) {
      result += str[i];
    }
    
    return result;
  }

  /**
   * Split line into tokens for analysis
   */
  tokenize(line) {
    const tokens = [];
    let current = "";
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const code = char.charCodeAt(0);
      
      // Break on spaces and OCR separators, but keep date/reference punctuation
      if (code === 32 || code === 9 || char === ':' || char === ';' || char === '|' || char === '=') {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }
    
    if (current.length > 0) {
      tokens.push(current);
    }
    
    return tokens;
  }

  isSeparatorLine(line) {
    if (!line || line.length < 3) return false;

    let repeated = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '=' || char === '-' || char === '_' || char === '*') {
        repeated++;
      }
    }

    return repeated >= Math.floor(line.length * 0.7);
  }

  // =========================================================================
  // STEP 2: ZONE DETECTION
  // =========================================================================

  /**
   * Split document into logical zones based on line position and content
   * - header: top 30% of document (supplier info, invoice header)
   * - body: middle 50% (line items, products)
   * - footer: bottom 20% (totals, payment info)
   */
  detectZones(lines) {
    const zones = {
      header: { start: 0, end: 0, lines: [] },
      body: { start: 0, end: 0, lines: [] },
      footer: { start: 0, end: 0, lines: [] }
    };

    if (lines.length === 0) return zones;

    // First pass: detect content-based zone markers
    let footerStartLine = -1;
    let hasTotalsMarker = false;

    for (let i = 0; i < lines.length; i++) {
      const lineLower = this.toLowerCaseSafe(lines[i].cleaned);

      // Detect footer start by totals keywords
      if (this.containsSubstring(lineLower, "total ttc") ||
          this.containsSubstring(lineLower, "totalttc") ||
          this.hasFinalPayableTotalContext(lineLower) ||
          this.hasInvoicePresencePhrase(lineLower) ||
          this.containsSubstring(lineLower, "somme de")) {
        if (!hasTotalsMarker) {
          footerStartLine = i;
          hasTotalsMarker = true;
        }
      }
    }

    // Calculate zone boundaries with content-aware adjustment
    const baseHeaderEnd = Math.floor(lines.length * 0.30);
    const baseBodyEnd = Math.floor(lines.length * 0.75);

    // If we found a totals marker, use it to adjust footer start
    let headerEnd, bodyEnd;

    if (hasTotalsMarker && footerStartLine > 0) {
      // Footer starts at totals marker, but ensure minimum sizes
      footerStartLine = Math.max(Math.floor(lines.length * 0.5), footerStartLine);
      bodyEnd = footerStartLine;
      headerEnd = Math.min(Math.floor(lines.length * 0.35), footerStartLine - 1);
    } else {
      // Fall back to position-based zones
      headerEnd = baseHeaderEnd;
      bodyEnd = baseBodyEnd;
    }

    // Ensure minimum zone sizes
    const minLines = 3;
    if (headerEnd < minLines) headerEnd = Math.min(minLines, lines.length - 2);
    if (bodyEnd - headerEnd < minLines) bodyEnd = Math.min(headerEnd + minLines, lines.length - 1);
    if (lines.length - bodyEnd < minLines && lines.length > minLines * 2) {
      bodyEnd = Math.max(bodyEnd, lines.length - minLines);
    }

    zones.header.start = 0;
    zones.header.end = headerEnd - 1;
    zones.body.start = headerEnd;
    zones.body.end = bodyEnd - 1;
    zones.footer.start = bodyEnd;
    zones.footer.end = lines.length - 1;

    // Assign lines to zones
    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];

      if (i < headerEnd) {
        zones.header.lines.push(lineInfo);
      } else if (i < bodyEnd) {
        zones.body.lines.push(lineInfo);
      } else {
        zones.footer.lines.push(lineInfo);
      }
    }

    return zones;
  }

  buildBlocks(lines, zones) {
    const blocks = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];
      if (!lineInfo || lineInfo.lowTrust) continue;

      const zone = this.getZoneForLine(i, zones);
      const profile = this.getLineBlockProfile(lineInfo);

      if (!current || !this.canJoinBlock(current, lineInfo, profile, zone)) {
        if (current) {
          blocks.push(this.decorateBlock(current));
        }

        current = {
          lines: [lineInfo],
          zone,
          startIndex: i,
          endIndex: i,
          startSourceIndex: lineInfo.index,
          endSourceIndex: lineInfo.index,
          profile
        };
      } else {
        current.lines.push(lineInfo);
        current.endIndex = i;
        current.endSourceIndex = lineInfo.index;
      }
    }

    if (current) {
      blocks.push(this.decorateBlock(current));
    }

    return blocks;
  }

  decorateBlock(block) {
    if (!block) return block;
    block.profile = this.finalizeBlockProfile(block);
    block.mergedText = this.mergeBlockLines(block.lines || []);
    block.tokens = this.tokenize(block.mergedText || "");
    return block;
  }

  getLineBlockProfile(lineInfo) {
    const line = this.toLowerCaseSafe(lineInfo.cleaned);
    const letters = this.countLetters(lineInfo.cleaned);
    const digits = this.countDigits(lineInfo.cleaned);
    const moneyCount = this.countMoneyLikeTokens(lineInfo.tokens);
    const supplierLineScore = this.scoreSupplierLineQuality(lineInfo.cleaned);
    const totalsLineScore = this.scoreTotalsLineQuality(lineInfo.cleaned, lineInfo.tokens);

    return {
      hasInvoice: this.containsAnyKeyword(line, this.invoiceKeywords),
      hasClient: this.containsSubstring(line, "client"),
      hasAdmin: this.containsAnyKeyword(line, this.excludeKeywords),
      hasMoney: moneyCount > 0,
      hasTotals: this.containsAnyKeyword(line, this.moneyKeywords.ht) ||
        this.containsAnyKeyword(line, this.moneyKeywords.tva) ||
        this.containsAnyKeyword(line, this.moneyKeywords.ttc) ||
        this.containsSubstring(line, "total") ||
        this.containsSubstring(line, "somme") ||
        totalsLineScore >= 55,
      mostlyText: letters > digits * 2,
      supplierLike: supplierLineScore >= 55,
      supplierLineScore,
      totalsLike: totalsLineScore >= 55,
      totalsLineScore,
      letters,
      digits,
      moneyCount
    };
  }

  canJoinBlock(block, lineInfo, profile, zone) {
    if (block.zone !== zone) return false;
    if (lineInfo.index - block.endSourceIndex > 2) return false;

    const blockProfile = block.profile;

    if (profile.hasInvoice || blockProfile.hasInvoice) return false;
    if (profile.hasClient || blockProfile.hasClient) return false;

    if ((profile.hasTotals || profile.hasMoney) && (blockProfile.hasTotals || blockProfile.hasMoney)) {
      return true;
    }

    if (profile.hasAdmin !== blockProfile.hasAdmin) return false;

    if (profile.mostlyText && blockProfile.mostlyText) {
      return true;
    }

    return false;
  }

  finalizeBlockProfile(block) {
    const result = {
      hasInvoice: false,
      hasClient: false,
      hasAdmin: false,
      hasMoney: false,
      hasTotals: false,
      mostlyText: false,
      supplierLike: false,
      totalsLike: false
    };

    let textLikeCount = 0;
    let supplierLikeCount = 0;
    let totalsLikeCount = 0;
    for (let i = 0; i < block.lines.length; i++) {
      const profile = this.getLineBlockProfile(block.lines[i]);
      if (profile.hasInvoice) result.hasInvoice = true;
      if (profile.hasClient) result.hasClient = true;
      if (profile.hasAdmin) result.hasAdmin = true;
      if (profile.hasMoney) result.hasMoney = true;
      if (profile.hasTotals) result.hasTotals = true;
      if (profile.mostlyText) textLikeCount++;
      if (profile.supplierLike) supplierLikeCount++;
      if (profile.totalsLike) totalsLikeCount++;
    }

    result.mostlyText = textLikeCount >= Math.ceil(block.lines.length / 2);
    result.supplierLike = supplierLikeCount > 0;
    result.totalsLike = totalsLikeCount > 0;
    return result;
  }

  // =========================================================================
  // STEP 3: LINE CLASSIFICATION
  // =========================================================================

  /**
   * Classify each line by content type
   */
  classifyLines(lines) {
    const classified = [];

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];
      const classification = this.classifyLine(lineInfo);
      classified.push({
        ...lineInfo,
        classification
      });
    }

    return classified;
  }

  /**
   * Classify a single line by content type
   * Returns: supplier-like, reference-like, date-like, money-like, 
   *          contact/admin-like, product-like, totals-like, or unknown
   */
  classifyLine(lineInfo) {
    if (lineInfo.lowTrust) {
      return {
        types: ["noise"],
        scores: { noise: 100 - lineInfo.trustScore },
        primary: "noise"
      };
    }

    const line = lineInfo.cleaned.toLowerCase();
    const tokens = lineInfo.tokens;
    
    let types = [];
    let scores = {};

    // Check for supplier indicators
    const supplierScore = this.checkSupplierIndicators(line, tokens);
    if (supplierScore > 0) {
      types.push("supplier");
      scores.supplier = supplierScore;
    }

    // Check for invoice reference indicators
    const refScore = this.checkReferenceIndicators(line, tokens);
    if (refScore > 0) {
      types.push("reference");
      scores.reference = refScore;
    }

    // Check for date indicators
    const dateScore = this.checkDateIndicators(line, tokens);
    if (dateScore > 0) {
      types.push("date");
      scores.date = dateScore;
    }

    // Check for money indicators
    const moneyResult = this.checkMoneyIndicators(line, tokens);
    if (moneyResult && moneyResult.score > 0) {
      types.push("money");
      scores.money = moneyResult.score;
      scores.moneyType = moneyResult.type; // ht, tva, ttc
    }

    // Check for contact/admin indicators
    const adminScore = this.checkAdminIndicators(line, tokens);
    if (adminScore > 0) {
      types.push("admin");
      scores.admin = adminScore;
    }

    // Check for totals indicators
    const totalsScore = this.checkTotalsIndicators(line, tokens);
    if (totalsScore > 0) {
      types.push("totals");
      scores.totals = totalsScore;
    }

    // Check for product-like lines
    const productScore = this.checkProductIndicators(line, tokens);
    if (productScore > 0) {
      types.push("product");
      scores.product = productScore;
    }

    return {
      types,
      scores,
      primary: types.length > 0 ? types[0] : "unknown"
    };
  }

  checkSupplierIndicators(line, tokens) {
    let score = 0;
    
    // Check for supplier keywords
    for (let i = 0; i < this.supplierKeywords.length; i++) {
      const keyword = this.supplierKeywords[i];
      if (this.containsSubstring(line, keyword)) {
        score += 20;
      }
    }

    // Prefer lines in header zone
    // Prefer lines with mixed letters (company names)
    let letterCount = 0;
    let digitCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      for (let j = 0; j < token.length; j++) {
        const code = token.charCodeAt(j);
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
          letterCount++;
        } else if (code >= 48 && code <= 57) {
          digitCount++;
        }
      }
    }

    // Good supplier lines have more letters than digits
    if (letterCount > digitCount * 2) {
      score += 15;
    }

    // Penalize lines with too many numbers
    if (digitCount > letterCount) {
      score -= 20;
    }

    return Math.max(0, score);
  }

  checkReferenceIndicators(line, tokens) {
    let score = 0;
    
    // Check for invoice keywords
    for (let i = 0; i < this.invoiceKeywords.length; i++) {
      const keyword = this.invoiceKeywords[i];
      if (this.containsSubstring(line, keyword)) {
        score += 25;
      }
    }

    // Check for reference patterns (alphanumeric codes)
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.looksLikeReference(token)) {
        score += 30;
      }
    }

    return Math.max(0, score);
  }

  checkDateIndicators(line, tokens) {
    let score = 0;
    
    // Check for date keywords
    for (let i = 0; i < this.dateKeywords.length; i++) {
      const keyword = this.dateKeywords[i];
      if (this.containsSubstring(line, keyword)) {
        score += 20;
      }
    }

    // Check for date patterns
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.looksLikeDate(token)) {
        score += 35;
      }
    }

    const embeddedDates = this.extractDateTokensFromText(line);
    if (embeddedDates.length > 0) {
      score += 35;
    }

    const localizedDates = this.extractFrenchMonthDateTokensFromText(line);
    if (localizedDates.length > 0) {
      score += 35;
    }

    return Math.max(0, score);
  }

  checkMoneyIndicators(line, tokens) {
    let score = 0;
    let type = null;

    // Check for money keywords
    for (let i = 0; i < this.moneyKeywords.ht.length; i++) {
      const keyword = this.moneyKeywords.ht[i];
      if (this.containsSubstring(line, keyword)) {
        score += 30;
        type = "ht";
        break;
      }
    }

    if (type === null) {
      for (let i = 0; i < this.moneyKeywords.tva.length; i++) {
        const keyword = this.moneyKeywords.tva[i];
        if (this.containsSubstring(line, keyword)) {
          score += 30;
          type = "tva";
          break;
        }
      }
    }

    if (type === null) {
      for (let i = 0; i < this.moneyKeywords.ttc.length; i++) {
        const keyword = this.moneyKeywords.ttc[i];
        if (this.containsSubstring(line, keyword)) {
          score += 30;
          type = "ttc";
          break;
        }
      }
    }

    // Check for currency symbols
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.containsCurrencySymbol(token)) {
        score += 15;
      }
    }

    // Check for money-like numbers
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.looksLikeMoney(token)) {
        score += 20;
      }
    }

    return score > 0 ? { score, type } : 0;
  }

  checkAdminIndicators(line, tokens) {
    let score = 0;
    
    // Check for admin/phone keywords
    for (let i = 0; i < this.excludeKeywords.length; i++) {
      const keyword = this.excludeKeywords[i];
      if (this.containsSubstring(line, keyword)) {
        score += 25;
      }
    }

    // Check for phone number patterns
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.looksLikePhone(token)) {
        score += 20;
      }
    }

    return Math.max(0, score);
  }

  checkTotalsIndicators(line, tokens) {
    let score = 0;
    
    // Check for total keywords
    const totalKeywords = ["total", "totaux", "somme", "montant", "net"];
    for (let i = 0; i < totalKeywords.length; i++) {
      if (this.containsSubstring(line, totalKeywords[i])) {
        score += 20;
      }
    }

    // Lines with multiple money values are likely totals lines
    let moneyCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (this.looksLikeMoney(tokens[i])) {
        moneyCount++;
      }
    }

    if (moneyCount >= 2) {
      score += 25;
    }

    return Math.max(0, score);
  }

  checkProductIndicators(line, tokens) {
    let score = 0;
    
    // Product lines often have: description, quantity, unit price
    // Look for patterns like "X20" or dimensions
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.looksLikeProductCode(token)) {
        score += 15;
      }
    }

    return Math.max(0, score);
  }

  // =========================================================================
  // STEP 4: CANDIDATE EXTRACTION
  // =========================================================================

  /**
   * Extract candidates for each field from classified lines
   */
  extractCandidates(text, lines, zones, classifiedLines, blocks) {
    const candidates = {
      numeroFacture: [],
      fournisseur: [],
      ice: [],
      dateFacture: [],
      montantHt: [],
      tva: [],
      montantTtc: []
    };

    // Block-first extraction
    candidates.numeroFacture = this.mergeCandidateLists(
      this.extractInvoiceNumberBlockCandidates(blocks, zones),
      this.extractInvoiceNumberCandidates(classifiedLines, zones)
    );

    // Table-layout extraction for invoices with header/value on separate rows
    const tableCandidates = this.extractTableLayoutCandidates(classifiedLines, zones);
    candidates.numeroFacture = this.mergeCandidateLists(candidates.numeroFacture, tableCandidates.numeroFacture);
    candidates.dateFacture = this.mergeCandidateLists(candidates.dateFacture, tableCandidates.dateFacture);

    // Supplier is already block-oriented, keep line fallback inside extractor
    candidates.fournisseur = this.extractSupplierCandidates(classifiedLines, zones, blocks);

    candidates.ice = this.mergeCandidateLists(
      this.extractIceBlockCandidates(blocks, zones),
      this.extractIceCandidates(classifiedLines, zones)
    );

    candidates.dateFacture = this.mergeCandidateLists(
      this.extractDateBlockCandidates(blocks, zones),
      this.extractDateCandidates(classifiedLines, zones)
    );

    // Extract money candidates (as triplets)
    const moneyCandidates = this.extractMoneyCandidates(classifiedLines, zones, blocks);
    candidates.montantHt = moneyCandidates.ht;
    candidates.tva = moneyCandidates.tva;
    candidates.montantTtc = moneyCandidates.ttc;

    this.mergeNoisyAgentCandidates(text, candidates, classifiedLines, zones);

    return candidates;
  }

  loadNoisyInvoiceAgent() {
    try {
      if (typeof require !== "undefined") {
        // const agent = require("./agent.js"); // Module not found during build - using fallback instead
        const agent = null;
        if (agent && typeof agent.extractNoisyInvoiceCandidates === "function") {
          return agent;
        }
      }
    } catch (error) {
      // Ignore missing helper in environments where require is unavailable.
    }

    if (typeof window !== "undefined" &&
        window.NoisyInvoiceAgent &&
        typeof window.NoisyInvoiceAgent.extractNoisyInvoiceCandidates === "function") {
      return window.NoisyInvoiceAgent;
    }

    return null;
  }

  mergeNoisyAgentCandidates(text, candidates, classifiedLines, zones) {
    if (!this.noisyInvoiceAgent ||
        typeof this.noisyInvoiceAgent.extractNoisyInvoiceCandidates !== "function") {
      return;
    }

    const noisy = this.noisyInvoiceAgent.extractNoisyInvoiceCandidates(text, {
      classifiedLines,
      zones
    });
    if (!noisy || typeof noisy !== "object") return;

    candidates.numeroFacture = this.mergeCandidateLists(candidates.numeroFacture, noisy.numeroFacture);
    candidates.fournisseur = this.mergeCandidateLists(candidates.fournisseur, noisy.fournisseur);
    candidates.ice = this.mergeCandidateLists(candidates.ice, noisy.ice);
    candidates.dateFacture = this.mergeCandidateLists(candidates.dateFacture, noisy.dateFacture);
    candidates.montantHt = this.mergeCandidateLists(candidates.montantHt, noisy.montantHt);
    candidates.tva = this.mergeCandidateLists(candidates.tva, noisy.tva);
    candidates.montantTtc = this.mergeCandidateLists(candidates.montantTtc, noisy.montantTtc);
  }

  mergeCandidateLists(primary, secondary) {
    const merged = [];
    const first = primary || [];
    const second = secondary || [];

    for (let i = 0; i < first.length; i++) {
      if (!this.candidateExists(merged, first[i])) merged.push(first[i]);
    }

    for (let i = 0; i < second.length; i++) {
      if (!this.candidateExists(merged, second[i])) merged.push(second[i]);
    }

    return this.deduplicateFieldCandidates(merged);
  }

  extractInvoiceNumberBlockCandidates(blocks, zones) {
    const candidates = [];
    const list = blocks || [];
    const earlyBodyLimit = zones && zones.body ? Math.floor((zones.body.end + 1) * 0.6) : 999;

    for (let i = 0; i < list.length; i++) {
      const block = list[i];
      if (!block || !block.mergedText) continue;
      if (block.startIndex > earlyBodyLimit && block.zone !== "header") continue;

      const mergedText = block.mergedText;
      const hasInvoiceContext =
        block.profile && block.profile.hasInvoice ||
        this.isInvoiceReferenceContext(mergedText);

      if (!hasInvoiceContext) continue;

      const inlineReference = this.extractInvoiceReferenceFromText(mergedText);
      if (inlineReference && this.isLikelyInvoiceReference(inlineReference, mergedText)) {
        candidates.push({
          value: inlineReference,
          lineIndex: block.startIndex,
          zone: block.zone,
          context: mergedText,
          reasons: ["extracted from merged block", "invoice context block"]
        });
      }

      const tokens = block.tokens || [];
      for (let j = 0; j < tokens.length; j++) {
        const marker = this.toLowerCaseSafe(this.trimSafe(tokens[j] || ""));
        const markerLooksRelevant =
          marker === "facture" ||
          marker === "invoice" ||
          this.isInvoiceMarkerToken(marker) ||
          marker === "numero" ||
          marker === "num";

        if (!markerLooksRelevant) continue;

        for (let k = j + 1; k < Math.min(tokens.length, j + 6); k++) {
          const token = this.normalizeReferenceToken(tokens[k]);
          if (!token || token.length <= 1) continue;
          if (this.looksLikeDate(token)) continue;
          if (this.isInvoiceMarkerToken(this.toLowerCaseSafe(token))) continue;
          if (this.containsSubstring(this.toLowerCaseSafe(token), "ice")) continue;
          if (this.containsSubstring(this.toLowerCaseSafe(token), "date")) continue;
          if (this.looksLikePureNumber(token) && token.length > 12) continue;
          // Skip delivery note numbers (BL + digits)
          if (/^BL\d/i.test(token)) continue;
          if (!this.isLikelyInvoiceReference(token, mergedText)) continue;

          candidates.push({
            value: token,
            lineIndex: block.startIndex,
            zone: block.zone,
            context: mergedText,
            reasons: ["reference found near invoice marker in block"]
          });
          break;
        }
      }
    }

    return this.deduplicateFieldCandidates(candidates);
  }

  extractIceBlockCandidates(blocks, zones) {
    const candidates = [];
    const list = blocks || [];

    for (let i = 0; i < list.length; i++) {
      const block = list[i];
      if (!block || !block.mergedText) continue;

      const mergedText = block.mergedText;
      const lower = this.toLowerCaseSafe(mergedText);
      if (!this.containsSubstring(lower, "ice")) continue;

      const tokens = block.tokens || [];
      const inlineCandidate = this.extractIceNumberFromTokens(tokens);
      if (inlineCandidate) {
        candidates.push({
          value: inlineCandidate,
          lineIndex: block.startIndex,
          zone: block.zone,
          context: mergedText,
          reasons: ["found in ICE block"]
        });
        continue;
      }

      if (this.isIceMarkerOnlyLine(tokens)) {
        const standalone = this.extractStandaloneIceNumber(tokens);
        if (standalone) {
          candidates.push({
            value: standalone,
            lineIndex: block.startIndex,
            zone: block.zone,
            context: mergedText,
            reasons: ["found after merged ice marker block"]
          });
        }
      }
    }

    return this.deduplicateFieldCandidates(candidates);
  }

  extractDateBlockCandidates(blocks, zones) {
    const candidates = [];
    const list = blocks || [];
    const seen = {};

    for (let i = 0; i < list.length; i++) {
      const block = list[i];
      if (!block || !block.mergedText) continue;

      const mergedText = block.mergedText;
      const lower = this.toLowerCaseSafe(mergedText);

      // Skip delivery/expiration date blocks
      if (this.containsSubstring(lower, "delivraison") ||
          this.containsSubstring(lower, "livraison") ||
          this.containsSubstring(lower, "echeance") ||
          this.containsSubstring(lower, "écheance") ||
          this.containsSubstring(lower, "expiration")) {
        continue;
      }

      const likelyDateBlock =
        block.zone === "header" ||
        this.containsAnyKeyword(lower, this.dateKeywords) ||
        (block.profile && block.profile.hasInvoice);

      if (!likelyDateBlock) continue;

      const tokens = (block.tokens || []).slice();
      const embeddedDates = this.extractDateTokensFromText(mergedText);
      for (let j = 0; j < embeddedDates.length; j++) {
        tokens.push(embeddedDates[j]);
      }
      const localizedDates = this.extractFrenchMonthDateTokensFromText(mergedText);
      for (let j = 0; j < localizedDates.length; j++) {
        tokens.push(localizedDates[j]);
      }

      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        if (!this.looksLikeDate(token)) continue;

        const parsedDate = this.parseDate(token);
        if (!parsedDate.valid) continue;

        const dedupeKey = token + "|" + block.startIndex;
        if (seen[dedupeKey]) continue;
        seen[dedupeKey] = true;

        candidates.push({
          value: token,
          parsed: parsedDate,
          lineIndex: block.startIndex,
          zone: block.zone,
          context: mergedText,
          reasons: ["matches date pattern", "found in merged block"]
        });
      }
    }

    return candidates;
  }

  extractIceCandidates(classifiedLines, zones) {
    const lines = classifiedLines || [];
    const candidates = [];

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];
      if (!lineInfo || !lineInfo.cleaned) continue;

      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      if (!this.containsSubstring(lower, "ice")) continue;

      const lineCandidate = this.extractIceNumberFromTokens(lineInfo.tokens || []);
      if (lineCandidate) {
        candidates.push({
          value: lineCandidate,
          lineIndex: i,
          zone: this.getZoneForLine(i, zones),
          context: lineInfo.cleaned,
          reasons: ["found in ice-labeled line"]
        });
      } else if (this.isIceMarkerOnlyLine(lineInfo.tokens || []) && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextCandidate = this.extractStandaloneIceNumber(nextLine && nextLine.tokens ? nextLine.tokens : []);
        if (nextCandidate) {
          candidates.push({
            value: nextCandidate,
            lineIndex: i + 1,
            zone: this.getZoneForLine(i + 1, zones),
            context: (lineInfo.cleaned || "") + " " + (nextLine && nextLine.cleaned ? nextLine.cleaned : ""),
            reasons: ["found after standalone ice marker"]
          });
        }
      }
    }

    return this.deduplicateFieldCandidates(candidates);
  }

  extractInvoiceNumberCandidates(classifiedLines, zones) {
    const candidates = [];

    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      const markerOnlyLine = this.isInvoiceOnlyMarkerLine(lineInfo.tokens, lineInfo.cleaned);
      const line = this.toLowerCaseSafe(lineInfo.cleaned || "");
      if (lineInfo.lowTrust &&
          lineInfo.tokens &&
          lineInfo.tokens.length >= 2 &&
          this.isInvoiceMarkerToken(this.toLowerCaseSafe(this.trimSafe(lineInfo.tokens[0])))) {
        const inlineToken = this.normalizeReferenceToken(lineInfo.tokens[1]);
        if (inlineToken.length > 2 &&
            !this.looksLikeDate(inlineToken) &&
            (this.isLikelyInvoiceReference(inlineToken, lineInfo.cleaned) ||
             (this.looksLikePureNumber(inlineToken) && inlineToken.length >= 6))) {
          candidates.push({
            value: inlineToken,
            lineIndex: i,
            zone: this.getZoneForLine(i, zones),
            context: lineInfo.cleaned,
            reasons: ["found on compact invoice marker line"]
          });
        }
      }

      if (lineInfo.lowTrust &&
          this.containsSubstring(line, "facture") &&
          i + 1 < classifiedLines.length) {
        const nextLine = classifiedLines[i + 1];
        if (nextLine) {
          for (let j = 0; j < (nextLine.tokens || []).length; j++) {
            const nextToken = this.normalizeReferenceToken(nextLine.tokens[j]);
            if (nextToken.length <= 2) continue;
            if (this.looksLikeDate(nextToken)) continue;

            const context = lineInfo.cleaned + " " + nextLine.cleaned;
            if (!this.isLikelyInvoiceReference(nextToken, context) &&
                !(this.looksLikePureNumber(nextToken) && nextToken.length >= 6 && nextToken.length <= 12)) {
              continue;
            }

            candidates.push({
              value: nextToken,
              lineIndex: i + 1,
              zone: this.getZoneForLine(i + 1, zones),
              context,
              reasons: ["found after noisy facture label"]
            });
            break;
          }
        }
      }

      if (lineInfo.lowTrust && !markerOnlyLine) continue;
      const classification = lineInfo.classification;
      const invoiceContext = this.isInvoiceReferenceContext(lineInfo.cleaned);

      // Prioritize reference-like lines
      if (classification.types.indexOf("reference") !== -1 && invoiceContext) {
        const tokens = lineInfo.tokens;
        
        for (let j = 0; j < tokens.length; j++) {
          const token = tokens[j];
          
          // Skip if it looks like a date or pure number
          if (this.looksLikeDate(token)) continue;
          if (this.looksLikePureNumber(token)) continue;
          if (!this.isLikelyInvoiceReference(token, lineInfo.cleaned)) continue;
          
          // Check if it looks like a reference
          if (this.looksLikeReference(token)) {
            candidates.push({
              value: token,
              lineIndex: i,
              zone: this.getZoneForLine(i, zones),
              context: lineInfo.cleaned,
              reasons: ["found in reference line", "matches reference pattern"]
            });
          }
        }
      }

      // Also check lines near "facture" keyword
      if (this.containsSubstring(line, "facture")) {
        const tokens = lineInfo.tokens;
        const inlineReference = this.extractInvoiceReferenceFromText(lineInfo.cleaned);

        if (inlineReference && this.isLikelyInvoiceReference(inlineReference, lineInfo.cleaned)) {
          candidates.push({
            value: inlineReference,
            lineIndex: i,
            zone: this.getZoneForLine(i, zones),
            context: lineInfo.cleaned,
            reasons: ["extracted from merged facture label"]
          });
        }

        // OCR often merges labels like "N°delaFacture:A020-2025"
        // so also scan the full token list for any plausible reference
        for (let j = 0; j < tokens.length; j++) {
          const normalizedToken = this.normalizeReferenceToken(tokens[j]);
          if (normalizedToken.length <= 1) continue;
          if (this.looksLikeDate(normalizedToken)) continue;
          if (this.isLikelyInvoiceReference(normalizedToken, lineInfo.cleaned)) {
            candidates.push({
              value: normalizedToken,
              lineIndex: i,
              zone: this.getZoneForLine(i, zones),
              context: lineInfo.cleaned,
              reasons: ["found in facture-context line"]
            });
          }
        }
        
        // Look for tokens after "facture"
        for (let j = 0; j < tokens.length; j++) {
          const token = tokens[j];
          const lowerToken = token.toLowerCase();
          
          if (lowerToken === "facture") {
            for (let k = j + 1; k < Math.min(tokens.length, j + 4); k++) {
              const nextToken = this.normalizeReferenceToken(tokens[k]);
              if (nextToken.length <= 1) continue;
              if (this.looksLikeDate(nextToken)) continue;
              if (this.isLikelyInvoiceReference(nextToken, lineInfo.cleaned)) {
                candidates.push({
                  value: nextToken,
                  lineIndex: i,
                  zone: this.getZoneForLine(i, zones),
                  context: lineInfo.cleaned,
                  reasons: ["found after 'facture' keyword"]
                });
                break;
              }
            }
          }
        }

        // Some invoices put a bare "FACTURE" marker on one line
        // and the actual reference on the next line.
        if (i + 1 < classifiedLines.length) {
          const nextLine = classifiedLines[i + 1];
          if (nextLine) {
            for (let j = 0; j < nextLine.tokens.length; j++) {
              const nextToken = this.normalizeReferenceToken(nextLine.tokens[j]);
              if (nextToken.length <= 1) continue;
              if (this.looksLikeDate(nextToken)) continue;
              if (nextLine.lowTrust &&
                  !(this.looksLikePureNumber(nextToken) && nextToken.length >= 6 && nextToken.length <= 12)) {
                continue;
              }
              if (!this.isLikelyInvoiceReference(nextToken, lineInfo.cleaned + " " + nextLine.cleaned) &&
                  !(this.looksLikePureNumber(nextToken) && nextToken.length >= 6 && nextToken.length <= 12)) {
                continue;
              }

              candidates.push({
                value: nextToken,
                lineIndex: i + 1,
                zone: this.getZoneForLine(i + 1, zones),
                context: lineInfo.cleaned + " " + nextLine.cleaned,
                reasons: ["found on line after facture label"]
              });
              break;
            }
          }
        }
      }

      // Compact OCR sometimes glues "FACTUREN" into an admin/client line and
      // places the bare invoice number on the next line.
      if (this.containsSubstring(line, "facturen") && i + 1 < classifiedLines.length) {
        const nextLine = classifiedLines[i + 1];
        if (nextLine) {
          for (let j = 0; j < nextLine.tokens.length; j++) {
            const token = this.normalizeReferenceToken(nextLine.tokens[j]);
            if (token.length < 4) continue;
            if (this.looksLikeDate(token)) continue;

            const digitsOnly = this.looksLikePureNumber(token);
            const referenceLike = this.isLikelyInvoiceReference(token, lineInfo.cleaned + " " + nextLine.cleaned);
            if (referenceLike || (digitsOnly && token.length >= 6 && token.length <= 12)) {
              candidates.push({
                value: token,
                lineIndex: i + 1,
                zone: this.getZoneForLine(i + 1, zones),
                context: lineInfo.cleaned + " " + nextLine.cleaned,
                reasons: ["found after compact FACTUREN marker"]
              });
              break;
            }
          }
        }
      }

      const tokens = lineInfo.tokens;
      for (let j = 0; j + 1 < tokens.length; j++) {
        const marker = this.toLowerCaseSafe(this.trimSafe(tokens[j]));
        const nextToken = this.normalizeReferenceToken(tokens[j + 1]);
        if (this.isInvoiceMarkerToken(marker) &&
            this.isLikelyInvoiceReference(nextToken, lineInfo.cleaned) &&
            this.getZoneForLine(i, zones) === "header") {
          candidates.push({
            value: nextToken,
            lineIndex: i,
            zone: this.getZoneForLine(i, zones),
            context: lineInfo.cleaned,
            reasons: ["found after invoice marker"]
          });
        }
      }

      // OCR often puts the marker and the reference on separate lines:
      // N°:
      // 0025-SEP/2025 Maroc
      if (tokens.length > 0 &&
          this.isInvoiceOnlyMarkerLine(tokens, lineInfo.cleaned) &&
          i + 1 < classifiedLines.length) {
        const nextLine = classifiedLines[i + 1];
        if (nextLine && !nextLine.lowTrust) {
          for (let j = 0; j < nextLine.tokens.length; j++) {
            const nextToken = this.normalizeReferenceToken(nextLine.tokens[j]);
            if (nextToken.length <= 1) continue;
            if (this.looksLikeDate(nextToken)) continue;
            if (!this.isLikelyInvoiceReference(nextToken, lineInfo.cleaned + " " + nextLine.cleaned)) continue;

            candidates.push({
              value: nextToken,
              lineIndex: i + 1,
              zone: this.getZoneForLine(i + 1, zones),
              context: lineInfo.cleaned + " " + nextLine.cleaned,
              reasons: ["found on line after invoice marker"]
            });
            break;
          }
        }
      }

      // Handle "FACTURE N" or "FACTURE N°" without colon, value on same or next line
      if (this.containsSubstring(line, "facture n") || this.containsSubstring(line, "facture n°") ||
          this.containsSubstring(line, "facture n°:") || this.containsSubstring(line, "facture no")) {
        // Try to find value after the pattern on same line
        const factureIndex = line.indexOf("facture");
        if (factureIndex !== -1) {
          const afterFacture = lineInfo.cleaned.slice(factureIndex);
          const afterTokens = this.tokenize(afterFacture);
          for (let j = 1; j < Math.min(afterTokens.length, 5); j++) {
            const token = this.normalizeReferenceToken(afterTokens[j]);
            if (token.length <= 1) continue;
            if (this.looksLikeDate(token)) continue;
            if (this.isInvoiceMarkerToken(token.toLowerCase())) continue;
            if (this.isLikelyInvoiceReference(token, lineInfo.cleaned)) {
              candidates.push({
                value: token,
                lineIndex: i,
                zone: this.getZoneForLine(i, zones),
                context: lineInfo.cleaned,
                reasons: ["found after 'facture n' pattern"]
              });
              break;
            }
          }
        }
        // Also check next line if no value found on same line
        if (i + 1 < classifiedLines.length) {
          const nextLine = classifiedLines[i + 1];
          if (nextLine) {
            for (let j = 0; j < nextLine.tokens.length; j++) {
              const token = this.normalizeReferenceToken(nextLine.tokens[j]);
              if (token.length <= 2) continue;
              if (this.looksLikeDate(token)) continue;
              if (nextLine.lowTrust &&
                  !(this.looksLikePureNumber(token) && token.length >= 6 && token.length <= 12)) {
                continue;
              }
              if (this.isLikelyInvoiceReference(token, lineInfo.cleaned + " " + nextLine.cleaned) ||
                  (this.looksLikePureNumber(token) && token.length >= 6 && token.length <= 12)) {
                candidates.push({
                  value: token,
                  lineIndex: i + 1,
                  zone: this.getZoneForLine(i + 1, zones),
                  context: lineInfo.cleaned + " " + nextLine.cleaned,
                  reasons: ["found on line after 'facture n' marker"]
                });
                break;
              }
            }
          }
        }
      }
    }

    const stackedHeader = this.extractStackedHeaderFields(classifiedLines, zones);
    for (let i = 0; i < stackedHeader.numeroFacture.length; i++) {
      if (!this.candidateExists(candidates, stackedHeader.numeroFacture[i])) {
        candidates.push(stackedHeader.numeroFacture[i]);
      }
    }

    const factureGrid = this.extractFactureGridHeaderFields(classifiedLines, zones);
    for (let i = 0; i < factureGrid.numeroFacture.length; i++) {
      if (!this.candidateExists(candidates, factureGrid.numeroFacture[i])) {
        candidates.push(factureGrid.numeroFacture[i]);
      }
    }

    return this.deduplicateFieldCandidates(candidates);
  }

  isInvoiceOnlyMarkerLine(tokens, lineText) {
    if (!tokens || tokens.length === 0) return false;
    if (tokens.length > 2) return false;

    let markerCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (this.isInvoiceMarkerToken(this.toLowerCaseSafe(this.trimSafe(tokens[i])))) {
        markerCount++;
      }
    }

    if (markerCount === 0) return false;

    const lower = this.toLowerCaseSafe(lineText || "");
    return this.containsSubstring(lower, "n") || this.containsSubstring(lower, "no");
  }

  // =========================================================================
  // TABLE-LAYOUT INVOICE EXTRACTION
  // Handles invoices where headers and values are on separate rows
  // e.g. "Numero" on line N, "FA202602046" on line N+6
  // Also handles "Reference", "Référence" patterns common in BL/Facture
  // =========================================================================

  extractTableLayoutCandidates(classifiedLines, zones) {
    const candidates = { numeroFacture: [], dateFacture: [] };

    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (lineInfo.lowTrust) continue;
      const lineLower = this.toLowerCaseSafe(lineInfo.cleaned || "");
      const normalizedLabel = this.normalizeComparableText(lineInfo.cleaned || "");

      // === INVOICE NUMBER: "Numero" / "Num" / "N°" alone on a line ===
      if ((normalizedLabel === "numero" || normalizedLabel === "num" || normalizedLabel === "numéro") &&
          lineInfo.tokens && lineInfo.tokens.length === 1) {
        // Scan forward up to 15 lines for an invoice reference
        const searchLimit = Math.min(i + 15, classifiedLines.length);
        for (let j = i + 1; j < searchLimit; j++) {
          const nextLine = classifiedLines[j];
          if (nextLine.lowTrust) continue;

          // Skip header labels — they're in the same header row, values come after
          const nextLower = this.toLowerCaseSafe(nextLine.cleaned || "");
          if (nextLower === "date" || nextLower === "date écheance" || nextLower === "date echeance" ||
              nextLower === "code client" || nextLower === "mode de reglement" ||
              nextLower === "date delivraison" || nextLower === "date livraison" ||
              nextLower === "nice") continue;

          for (let k = 0; k < (nextLine.tokens || []).length; k++) {
            const token = this.normalizeReferenceToken(nextLine.tokens[k]);
            if (token.length <= 2) continue;
            if (this.looksLikeDate(token)) continue;
            if (this.isInvoiceMarkerToken(this.toLowerCaseSafe(token))) continue;
            if (this.containsSubstring(this.toLowerCaseSafe(token), "ice")) continue;
            // Skip delivery note numbers (BL + digits)
            if (/^BL\d/i.test(token)) continue;

            if (this.isLikelyInvoiceReference(token, nextLine.cleaned)) {
              candidates.numeroFacture.push({
                value: token,
                lineIndex: j,
                zone: this.getZoneForLine(j, zones),
                context: lineInfo.cleaned + " -> " + nextLine.cleaned,
                reasons: ["table-layout: value found after numero header"]
              });
              break;
            }
          }
          if (candidates.numeroFacture.length > 0) break;
        }
      }

      // === INVOICE NUMBER: "Reference" / "Référence" / "Ref" alone on a line ===
      if ((normalizedLabel === "reference" || normalizedLabel === "référence" || normalizedLabel === "ref") &&
          lineInfo.tokens && lineInfo.tokens.length === 1 &&
          !this.containsSubstring(lineLower, "bancaire") &&
          !this.containsSubstring(lineLower, "rib")) {
        const searchLimit = Math.min(i + 10, classifiedLines.length);
        for (let j = i + 1; j < searchLimit; j++) {
          const nextLine = classifiedLines[j];
          // Allow low-trust lines for reference values (often corrupted by OCR special chars)
          if (!nextLine) continue;

          const nextLower = this.toLowerCaseSafe(nextLine.cleaned || "");
          // Skip non-invoice-reference headers
          if (nextLower === "date" || nextLower === "code client" || nextLower === "mode de reglement" ||
              nextLower === "designation" || nextLower === "désignation" || nextLower === "code" ||
              nextLower === "description") break;

          for (let k = 0; k < (nextLine.tokens || []).length; k++) {
            const token = this.normalizeReferenceToken(nextLine.tokens[k]);
            if (token.length <= 2) continue;
            if (this.looksLikeDate(token)) continue;
            if (this.isInvoiceMarkerToken(this.toLowerCaseSafe(token))) continue;
            if (this.containsSubstring(this.toLowerCaseSafe(token), "ice")) continue;
            // Skip delivery note numbers (BL + digits)
            if (/^BL\d/i.test(token)) continue;

            // Accept reference-like tokens (alphanumeric with possible dashes/slashes)
            if (this.isLikelyInvoiceReference(token, nextLine.cleaned) ||
                (token.length >= 4 && token.length <= 20 && /[A-Za-z]/.test(token) && /\d/.test(token))) {
              candidates.numeroFacture.push({
                value: token,
                lineIndex: j,
                zone: this.getZoneForLine(j, zones),
                context: lineInfo.cleaned + " -> " + nextLine.cleaned,
                reasons: ["table-layout: value found after reference header"]
              });
              break;
            }
          }
          if (candidates.numeroFacture.length > 0) break;
        }
      }

      // === INLINE: "Reference:XXX" or "Reference :XXX" patterns ===
      if (this.containsSubstring(lineLower, "reference") || this.containsSubstring(lineLower, "référence")) {
        const tokens = lineInfo.tokens || [];
        for (let k = 0; k < tokens.length; k++) {
          const token = this.normalizeReferenceToken(tokens[k]);
          if (token.length < 4 || token.length > 20) continue;
          if (this.looksLikeDate(token)) continue;
          if (this.isInvoiceMarkerToken(this.toLowerCaseSafe(token))) continue;
          if (this.containsSubstring(this.toLowerCaseSafe(token), "ice")) continue;

          if (this.isLikelyInvoiceReference(token, lineInfo.cleaned) ||
              (/[A-Za-z]/.test(token) && /\d/.test(token))) {
            // Skip delivery note numbers
            if (/^BL\d/i.test(token)) continue;
            candidates.numeroFacture.push({
              value: token,
              lineIndex: i,
              zone: this.getZoneForLine(i, zones),
              context: lineInfo.cleaned,
              reasons: ["inline reference pattern"]
            });
            break;
          }
        }

        // If value is not on the same line, check the next line (even if low-trust due to OCR corruption)
        if (candidates.numeroFacture.length === 0 && i + 1 < classifiedLines.length) {
          const nextLine = classifiedLines[i + 1];
          if (nextLine) {
            for (let k = 0; k < (nextLine.tokens || []).length; k++) {
              const token = this.normalizeReferenceToken(nextLine.tokens[k]);
              if (token.length < 4 || token.length > 20) continue;
              if (this.looksLikeDate(token)) continue;
              if (this.isInvoiceMarkerToken(this.toLowerCaseSafe(token))) continue;
              if (this.containsSubstring(this.toLowerCaseSafe(token), "ice")) continue;
              // Allow pure numeric invoice references (common for "Reference: 26021716" patterns)
              if (/^\d{5,20}$/.test(token)) {
                candidates.numeroFacture.push({
                  value: token,
                  lineIndex: i + 1,
                  zone: this.getZoneForLine(i + 1, zones),
                  context: lineInfo.cleaned + " -> " + nextLine.cleaned,
                  reasons: ["reference value on next line (possibly OCR-corrupted)"]
                });
                break;
              }
            }
          }
        }
      }

      // === INLINE: "FACTUREN°XXX" or "FACTURE N° XXX" glued patterns ===
      const factureMatch = this.extractGluedFactureNumber(lineInfo.cleaned);
      if (factureMatch) {
        candidates.numeroFacture.push({
          value: factureMatch,
          lineIndex: i,
          zone: this.getZoneForLine(i, zones),
          context: lineInfo.cleaned,
          reasons: ["glued facture number pattern"]
        });
      }

      // === INVOICE DATE: "Date" alone on a line (not "Date delivraison" etc.) ===
      if (normalizedLabel === "date" &&
          lineInfo.tokens && lineInfo.tokens.length === 1) {
        // Scan forward up to 15 lines for a date value
        const searchLimit = Math.min(i + 15, classifiedLines.length);
        for (let j = i + 1; j < searchLimit; j++) {
          const nextLine = classifiedLines[j];
          if (nextLine.lowTrust) continue;

          const nextLower = this.toLowerCaseSafe(nextLine.cleaned || "");
          // Skip other date headers (e.g. "Date écheance", "Date delivraison")
          if (nextLower === "date écheance" || nextLower === "date echeance" ||
              nextLower === "date delivraison" || nextLower === "date livraison") continue;
          // Skip non-date header labels — don't break, values come after all headers
          if (nextLower === "code client" || nextLower === "mode de reglement" ||
              nextLower === "nice") continue;

          for (let k = 0; k < (nextLine.tokens || []).length; k++) {
            const token = nextLine.tokens[k];
            if (!this.looksLikeDate(token)) continue;

            const parsedDate = this.parseDate(token);
            if (!parsedDate.valid) continue;

            candidates.dateFacture.push({
              value: token,
              parsed: parsedDate,
              lineIndex: j,
              zone: this.getZoneForLine(j, zones),
              context: lineInfo.cleaned + " -> " + nextLine.cleaned,
              reasons: ["table-layout: date found after date header"]
            });
            break;
          }
          if (candidates.dateFacture.length > 0) break;
        }
      }
    }

    return candidates;
  }

  // Extract glued facture numbers like "FACTUREN°52", "FACTURENÂ°52"
  extractGluedFactureNumber(text) {
    if (!text) return null;
    const upper = text.toUpperCase();

    // Match patterns like FACTUREN°XXX, FACTURENÂ°XXX, FACTUREN:XXX, FACTUREN°:XXX
    const patterns = [
      /FACTURE\s*N[Â\u0080]?[:°]\s*(\S+)/i,
      /FACTURE\s*N[Â\u0080]?\s*[:°]?\s*(\S+)/i,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      if (match && match[1]) {
        const value = match[1].replace(/[°:\s]/g, "");
        if (value.length >= 2 && value.length <= 20) {
          return value;
        }
      }
    }

    // Also try "DateXXX" glued patterns for French month dates
    const dateMatch = text.match(/Date\s*(\d{1,2}[\/\-.]\s*\d{1,2}[\/\-.]\s*\d{2,4})/i);
    if (dateMatch && dateMatch[1]) {
      return null; // handled by date extraction
    }

    return null;
  }

  extractSupplierCandidates(classifiedLines, zones, blocks) {
    const candidates = [];

    if (blocks && blocks.length > 0) {
      const blockCandidates = this.extractSupplierBlockCandidates(blocks, zones);
      for (let i = 0; i < blockCandidates.length; i++) {
        candidates.push(blockCandidates[i]);
      }
    }

    // Search in header AND early body (first 50% of document)
    const headerStart = zones.header.start;
    const searchEnd = Math.max(zones.header.end, Math.floor(classifiedLines.length * 0.5));

    for (let i = headerStart; i <= searchEnd && i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      
      if (!lineInfo || !lineInfo.classification) continue;
      if (lineInfo.lowTrust) continue;
      
      const classification = lineInfo.classification;
      const lineText = lineInfo.cleaned;
      const lineLower = lineText.toLowerCase();

      // Skip admin/contact lines
      if (classification.types && classification.types.indexOf("admin") !== -1) continue;
      // Don't skip "reference" if the line ALSO has "supplier" type and is very early in the doc
      const isEarlyHeader = i <= zones.header.start + 3;
      const hasSupplierType = classification.types && classification.types.indexOf("supplier") !== -1;
      if (classification.types && classification.types.indexOf("reference") !== -1) {
        if (!isEarlyHeader || !hasSupplierType) continue;
      }
	      if (this.looksLikeClientLine(lineText)) continue;
	      // Skip client/buyer blocks — lines followed by address keywords are likely client info
	      if (this.looksLikeClientBlock(lineText, classifiedLines, i)) continue;
	      if (this.containsEmailPattern(lineText)) continue;
	      const nextLineText = i + 1 < classifiedLines.length && classifiedLines[i + 1]
	        ? this.toLowerCaseSafe(classifiedLines[i + 1].cleaned)
	        : "";
	      if (this.tokenize(lineText).length === 1 &&
	          lineText === lineText.toUpperCase() &&
	          this.countLetters(lineText) >= 8 &&
	          !this.textHasSupplierAnchor(lineText) &&
	          !this.textHasSupplierKeyword(lineText) &&
	          (this.containsSubstring(nextLineText, "ice") ||
	           this.containsSubstring(nextLineText, "rue") ||
	           this.containsSubstring(nextLineText, "gueliz") ||
	           this.containsSubstring(nextLineText, "marrakech"))) {
	        continue;
	      }

	      // STRONG PENALTY: Skip lines with invoice/admin keywords
	      const hasExcludeKeyword = this.textHasExactKeyword(lineText, this.supplierExcludeKeywords);
      if (hasExcludeKeyword) continue;

      // Skip if too short or too long
      if (lineText.length < 5 || lineText.length > 100) continue;

      // Calculate supplier score
      let score = 50; // Base score
      const reasons = ["found in header/body zone"];

      // Bonus for being in header (stronger signal)
      if (i <= zones.header.end) {
        score += 10;
        reasons.push("in header zone");
      }

      // Strong bonus for being on the very first lines (L0-L2) — common for supplier name
      if (i <= zones.header.start + 2) {
        score += 15;
        reasons.push("very early document position");
      }

      // Bonus for being repeated on consecutive lines (OCR duplication = higher confidence)
      if (i > 0 && i - 1 < classifiedLines.length) {
        const prevLine = classifiedLines[i - 1];
        if (prevLine && !prevLine.lowTrust && prevLine.cleaned === lineText) {
          score += 10;
          reasons.push("repeated on consecutive lines");
        }
      }

      // Bonus for containing supplier keywords
      const hasSupplierKeyword = this.textHasSupplierKeyword(lineText);
      if (hasSupplierKeyword) {
        score += 25;
        reasons.push("contains supplier keyword");
      }

      // Bonus for good letter-to-digit ratio (company names have more letters)
      const letterCount = this.countLetters(lineText);
      const digitCount = this.countDigits(lineText);
      const totalChars = letterCount + digitCount;
      
      if (totalChars > 0) {
        const letterRatio = letterCount / totalChars;
        if (letterRatio > 0.7) {
          score += 25; // Strong bonus for mostly letters
          reasons.push("high letter ratio (" + (letterRatio * 100).toFixed(0) + "%)");
        } else if (letterRatio > 0.5) {
          score += 10;
          reasons.push("moderate letter ratio");
        } else if (letterRatio < 0.3) {
          score -= 30; // Strong penalty for mostly digits
          reasons.push("low letter ratio - likely not a company name");
        }
      }

      // Bonus for appropriate length (company names typically 10-60 chars)
      if (lineText.length >= 10 && lineText.length <= 60) {
        score += 15;
        reasons.push("appropriate length for company name");
      }

      if (i <= zones.header.end + 2 &&
          this.tokenize(lineText).length === 1 &&
          lineText === lineText.toUpperCase() &&
          letterCount >= 5 &&
          digitCount === 0) {
        score += 30;
        reasons.push("compact early header brand");
      }

      if (this.looksLikeAddressFragment(lineText) && !hasSupplierKeyword && !this.textHasSupplierAnchor(lineText)) {
        score -= 45;
        reasons.push("address-like fragment");
      }

      // Penalty for containing phone-like patterns
      if (this.containsPhonePattern(lineText)) {
        score -= 40;
        reasons.push("contains phone number pattern");
      }

      // Penalty for having multiple numbers/IDs
      const tokens = lineInfo.tokens;
      let numberTokenCount = 0;
      for (let j = 0; j < tokens.length; j++) {
        if (this.looksLikePureNumber(tokens[j]) && tokens[j].length > 4) {
          numberTokenCount++;
        }
      }
      if (numberTokenCount > 1) {
        score -= 20;
        reasons.push("contains multiple ID numbers");
      }

      score = Math.max(0, Math.min(100, score));

      candidates.push({
        value: lineText,
        lineIndex: lineInfo.index,
        zone: i <= zones.header.end ? "header" : "body",
        context: lineText,
        reasons,
        score
      });
    }

    // Preserve short supplier names that appear very early in the header.
    // OCR often puts the company name alone on the first line, and these
    // compact names can get outranked by noisier merged blocks.
    for (let i = headerStart; i <= Math.min(searchEnd, headerStart + 4) && i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo || lineInfo.lowTrust) continue;

      const lineText = this.normalizeSpaces(this.trimSafe(lineInfo.cleaned));
      const lineLower = this.toLowerCaseSafe(lineText);
      if (lineText.length < 6 || lineText.length > 40) continue;
      if (this.containsAnyKeyword(lineLower, this.supplierExcludeKeywords)) continue;
      if (this.looksLikeSupplierGarbage(lineText)) continue;
      if (!this.textHasSupplierAnchor(lineText) && !this.textHasSupplierKeyword(lineText)) continue;
      if (this.containsPhonePattern(lineText) || this.countDigits(lineText) > 0) continue;

      const candidate = {
        value: lineText,
        lineIndex: lineInfo.index,
        zone: "header",
        context: lineText,
        reasons: ["early header supplier fallback", "compact supplier name"],
        score: 78
      };

      if (!this.candidateExists(candidates, candidate)) {
        candidates.push(candidate);
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Also consider first meaningful line if no supplier found
    if (candidates.length === 0) {
      for (let i = headerStart; i <= searchEnd && i < classifiedLines.length; i++) {
        const lineInfo = classifiedLines[i];
        
        if (!lineInfo) continue;
        if (lineInfo.lowTrust) continue;
        
        const line = lineInfo.cleaned;
        const lineLower = line.toLowerCase();
        
        // Skip very short lines or lines with exclude keywords
        if (line.length < 10) continue;
        if (this.containsAnyKeyword(lineLower, this.supplierExcludeKeywords)) continue;
        
        candidates.push({
          value: line,
          lineIndex: lineInfo.index,
          zone: "header",
          context: line,
          reasons: ["first meaningful line"],
          score: 40
        });
        
        // Only take the first one
        break;
      }
    }

    return candidates;
  }

  extractSupplierBlockCandidates(blocks, zones) {
    const candidates = [];
    const headerBodyLimit = Math.floor((zones.body.end + 1) * 0.6);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block || block.lines.length === 0) continue;
      const mergedBlockText = this.mergeBlockLines(block.lines);
      const strongSupplierSignal = this.textHasSupplierAnchor(mergedBlockText);
      if (block.startIndex > headerBodyLimit && !strongSupplierSignal) continue;
      if (block.profile.hasInvoice || block.profile.hasClient || block.profile.hasTotals) continue;
      if (block.profile.hasAdmin && !strongSupplierSignal) continue;
      if (!block.profile.mostlyText || !block.profile.supplierLike) continue;

      const selectedLines = this.selectSupplierLinesFromBlock(block.lines);
      if (selectedLines.length === 0) continue;

      const mergedText = this.cleanupSupplierText(this.mergeBlockLines(selectedLines));
      const lower = this.toLowerCaseSafe(mergedText);
      if (mergedText.length < 8 || mergedText.length > 120) continue;
      if (this.containsEmailPattern(mergedText)) continue;
      if (this.containsAnyKeyword(lower, this.supplierExcludeKeywords)) continue;
      if (this.looksLikeClientLine(mergedText) && !this.textHasStrongSupplierAnchor(mergedText)) continue;
      if (this.textHasExactKeyword(mergedText, this.supplierNoiseKeywords)) continue;

      let score = 65;
      const reasons = ["merged text block"];

      if (block.zone === "header") {
        score += 20;
        reasons.push("header block");
      } else if (strongSupplierSignal) {
        score += 10;
        reasons.push("strong supplier signal outside header");
      }

      if (selectedLines.length > 1) {
        score += 15;
        reasons.push("multi-line block");
      }

      if (selectedLines.length < block.lines.length) {
        score += 10;
        reasons.push("trimmed noisy lines from block");
      }

      if (this.textHasSupplierKeyword(mergedText)) {
        score += 20;
        reasons.push("contains supplier keyword");
      }

      const letterCount = this.countLetters(mergedText);
      const digitCount = this.countDigits(mergedText);
      if (letterCount > digitCount * 3) {
        score += 10;
        reasons.push("text-heavy block");
      }

      candidates.push({
        value: mergedText,
        lineIndex: block.startIndex,
        zone: block.zone,
        context: mergedText,
        reasons,
        score: Math.max(0, Math.min(100, score))
      });
    }

    return candidates;
  }

  cleanupSupplierText(text) {
    if (!text) return text;

    const tokens = this.tokenize(text);
    if (tokens.length === 0) return text;

    let anchorIndex = -1;
    for (let i = 0; i < tokens.length; i++) {
      const tokenLower = this.toLowerCaseSafe(this.normalizeFrenchWord(tokens[i]));
      if (this.listHasExactKeyword(tokenLower, this.supplierAnchorKeywords)) {
        anchorIndex = i;
        break;
      }
    }

    let start = 0;
    if (anchorIndex !== -1) {
      start = Math.max(0, anchorIndex - 1);
      const prev = this.toLowerCaseSafe(this.normalizeFrenchWord(tokens[start]));
      if (prev === "a" || prev === "de" || prev === "du") {
        start = anchorIndex;
      }
    }

    let end = tokens.length - 1;
    for (let i = start; i < tokens.length; i++) {
      const tokenLower = this.toLowerCaseSafe(this.normalizeFrenchWord(tokens[i]));
      if (this.containsAnyKeyword(tokenLower, this.excludeKeywords) ||
          tokenLower === "capital" ||
          tokenLower === "siege" ||
          tokenLower === "siège" ||
          tokenLower === "tel" ||
          tokenLower === "fax") {
        end = i - 1;
        break;
      }
    }

    let result = "";
    for (let i = start; i <= end && i < tokens.length; i++) {
      if (result.length > 0) result += " ";
      result += tokens[i];
    }

    result = this.normalizeSpaces(this.trimSafe(result));
    result = this.trimSupplierTail(result);
    return result;
  }

  trimSupplierTail(text) {
    if (!text) return text;

    const lower = this.toLowerCaseSafe(text);
    const cutMarkers = [
      " pearl morocco travel",
      " vehicule ",
      " vehicle ",
      " client ",
      " adress",
      " adres",
      " ice ",
      // Cut at legal/capital info markers
      " au capital ",
      " à capital ",
      " au capitat ",
      " capital de ",
      " siège social",
      " siege social",
      " rue ",
      " lot ",
      " imm ",
      " étage ",
      " email ",
      " tél ",
      " tel:",
      " fax ",
      " rib ",
      " cnss ",
      " patente ",
      // Cut at admin markers
      " rc:",
      " rc :",
      " if:",
      " if :",
      " tp:",
      " tp :",
      " n°",
      " n°:",
      " adresse:"
    ];

    let cutIndex = -1;
    for (let i = 0; i < cutMarkers.length; i++) {
      const marker = cutMarkers[i];
      const index = lower.indexOf(marker);
      if (index !== -1 && (cutIndex === -1 || index < cutIndex)) {
        cutIndex = index;
      }
    }

    if (cutIndex !== -1) {
      text = text.slice(0, cutIndex);
    }

    // Remove trailing punctuation and fragments
    text = text.replace(/[,;\-\s]+$/, '');

    return this.normalizeSpaces(this.trimSafe(text));
  }

  looksLikeClientLine(text) {
    const lower = this.toLowerCaseSafe(text || "");
    return this.containsSubstring(lower, "client") ||
      this.containsSubstring(lower, "nbre de page") ||
      this.containsSubstring(lower, "nombre de page") ||
      this.containsSubstring(lower, "nom de rep") ||
      this.containsSubstring(lower, "prenom de rep") ||
      this.containsSubstring(lower, "payable a reception") ||
      this.containsSubstring(lower, "payable areception") ||
      this.containsSubstring(lower, "conditions") ||
      this.containsSubstring(lower, "pearl morocco travel") ||
      this.containsSubstring(lower, "***pearl morocco travel***");
  }

  // Detect if a line appears to be client/buyer info rather than supplier
  // Client info typically appears after invoice headers and is followed by address keywords
  looksLikeClientBlock(lineText, classifiedLines, lineIndex) {
    if (!lineText) return false;
    const lower = this.toLowerCaseSafe(lineText || "");

    // Skip very short single tokens (could be brand names)
    const tokens = this.tokenize(lineText);
    if (tokens.length === 1 && lineText.length <= 8) return false;

    // Check if nearby lines (within 3 lines after) contain address-like keywords
    for (let j = lineIndex + 1; j <= Math.min(lineIndex + 3, classifiedLines.length - 1); j++) {
      const nearbyText = this.toLowerCaseSafe(classifiedLines[j].cleaned || "");
      if (this.containsSubstring(nearbyText, "rue") ||
          this.containsSubstring(nearbyText, "gueliz") ||
          this.containsSubstring(nearbyText, "marrakech") ||
          this.containsSubstring(nearbyText, "agadir") ||
          this.containsSubstring(nearbyText, "casablanca") ||
          this.containsSubstring(nearbyText, "maroc") ||
          this.containsSubstring(nearbyText, "marocain") ||
          this.containsSubstring(nearbyText, "code postal") ||
          this.containsSubstring(nearbyText, "bp ")) {
        return true;
      }
    }

    return false;
  }

  listHasExactKeyword(word, keywords) {
    if (!word) return false;
    for (let i = 0; i < keywords.length; i++) {
      const keyword = this.toLowerCaseSafe(this.normalizeFrenchWord(keywords[i]));
      if (word === keyword) {
        return true;
      }
    }
    return false;
  }

  textHasSupplierAnchor(text) {
    const tokens = this.tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
      const token = this.toLowerCaseSafe(this.normalizeFrenchWord(tokens[i]));
      if (this.listHasExactKeyword(token, this.supplierAnchorKeywords)) {
        return true;
      }
    }
    return false;
  }

  textHasSupplierKeyword(text) {
    return this.textHasExactKeyword(text, this.supplierKeywords);
  }

  textHasStrongSupplierAnchor(text) {
    const tokens = this.tokenize(text || "");
    for (let i = 0; i < tokens.length; i++) {
      const token = this.toLowerCaseSafe(this.normalizeFrenchWord(tokens[i]));
      if (!this.listHasExactKeyword(token, this.supplierAnchorKeywords)) continue;
      if (token === "sa" || token === "sarl" || token === "sarlu" || token === "societe" || token === "sociÃ©tÃ©") {
        continue;
      }
      return true;
    }
    return false;
  }

  textHasExactKeyword(text, keywords) {
    const tokens = this.tokenize(text || "");
    for (let i = 0; i < tokens.length; i++) {
      const token = this.toLowerCaseSafe(this.normalizeFrenchWord(tokens[i]));
      if (this.listHasExactKeyword(token, keywords)) {
        return true;
      }
    }
    return false;
  }

  selectSupplierLinesFromBlock(lines) {
    const scored = [];
    for (let i = 0; i < lines.length; i++) {
      scored.push({
        lineInfo: lines[i],
        score: this.scoreSupplierLineQuality(lines[i].cleaned),
        anchored: this.textHasSupplierAnchor(lines[i].cleaned)
      });
    }

    for (let i = 0; i < scored.length; i++) {
      if (!scored[i].anchored) continue;

      const selected = [scored[i].lineInfo];
      for (let j = i + 1; j < scored.length && selected.length < 2; j++) {
        if (scored[j].score >= 65 && !this.containsAnyKeyword(this.toLowerCaseSafe(scored[j].lineInfo.cleaned), this.excludeKeywords)) {
          selected.push(scored[j].lineInfo);
        } else {
          break;
        }
      }
      return selected;
    }

    const selected = [];
    let weakStreak = 0;
    for (let i = 0; i < scored.length; i++) {
      const entry = scored[i];

      if (entry.score >= 65) {
        selected.push(entry.lineInfo);
        weakStreak = 0;
        continue;
      }

      if (selected.length > 0) {
        weakStreak++;
        if (weakStreak >= 1) {
          break;
        }
      }
    }

    if (selected.length > 0) {
      return selected.slice(0, 3);
    }

    let bestLine = null;
    let bestScore = -1;
    for (let i = 0; i < scored.length; i++) {
      if (scored[i].score > bestScore) {
        bestScore = scored[i].score;
        bestLine = scored[i].lineInfo;
      }
    }

    return bestLine ? [bestLine] : [];
  }

  scoreSupplierLineQuality(line) {
    if (!line) return 0;

    const lower = this.toLowerCaseSafe(line);
    let score = 50;
    const letters = this.countLetters(line);
    const digits = this.countDigits(line);
    const tokens = this.tokenize(line);

    if (this.containsAnyKeyword(lower, this.supplierExcludeKeywords)) {
      score -= 40;
    }

    if (this.textHasSupplierKeyword(line)) {
      score += 25;
    }

    if (this.textHasSupplierAnchor(line)) {
      score += 25;
    }

    if (this.containsSubstring(lower, "tour") ||
        this.containsSubstring(lower, "hotel") ||
        this.containsSubstring(lower, "pharm") ||
        this.containsSubstring(lower, "rent") ||
        this.containsSubstring(lower, "location") ||
        this.containsSubstring(lower, "services")) {
      score += 15;
    }

    if (letters > digits * 3) {
      score += 15;
    } else if (digits > letters) {
      score -= 20;
    }

    if (line.length >= 8 && line.length <= 60) {
      score += 10;
    } else if (line.length > 80) {
      score -= 15;
    }

    if (this.containsPhonePattern(line) || this.containsEmailPattern(line)) {
      score -= 35;
    }

    if (this.containsSubstring(lower, "client") ||
        this.containsSubstring(lower, "vehicule") ||
        this.containsSubstring(lower, "vehicle") ||
        this.containsSubstring(lower, "pearl morocco travel") ||
        this.containsSubstring(lower, "pearl")) {
      score -= 35;
    }

    if (this.containsSubstring(lower, "emetteur") ||
        this.containsSubstring(lower, "Ã©metteur") ||
        this.containsSubstring(lower, "adress") ||
        this.containsSubstring(lower, "adres")) {
      score -= 60;
    }

    let shortTokenCount = 0;
    let mediumTokenCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].length <= 2) shortTokenCount++;
      if (tokens[i].length >= 4) mediumTokenCount++;
    }

    if (tokens.length > 0 && shortTokenCount >= Math.ceil(tokens.length * 0.6)) {
      score -= 35;
    }

    if (mediumTokenCount < 2) {
      score -= 20;
    }

    if (tokens.length <= 4 && line.length < 18) {
      score -= 15;
    }

    if (!this.containsAnyKeyword(lower, this.supplierKeywords) &&
        !this.containsSubstring(lower, "tour") &&
        !this.containsSubstring(lower, "hotel") &&
        !this.containsSubstring(lower, "pharm") &&
        !this.containsSubstring(lower, "rent") &&
        !this.containsSubstring(lower, "location") &&
        !this.containsSubstring(lower, "marjane") &&
        !this.containsSubstring(lower, "electro") &&
        !this.containsSubstring(lower, "khadamat") &&
        !this.containsSubstring(lower, "massar")) {
      score -= 10;
    }

    if (this.textHasExactKeyword(line, this.supplierNoiseKeywords)) {
      score -= 45;
    }

    if (this.looksLikeSupplierGarbage(line)) {
      score -= 80;
    }

    return Math.max(0, Math.min(100, score));
  }

  looksLikeSupplierGarbage(text) {
    if (!text) return true;

    const tokens = this.tokenize(text);
    if (tokens.length === 0) return true;
    const lower = this.toLowerCaseSafe(text);

    if (tokens.length === 1) {
      const token = tokens[0];
      const letters = this.countLetters(token);
      const digits = this.countDigits(token);
      if (letters >= 5 && digits === 0 && token === token.toUpperCase()) {
        return false;
      }
      // Allow short brand names with digits like "1PORT", "3M", etc.
      if (letters >= 3 && token === token.toUpperCase() && letters + digits >= 3) {
        return false;
      }
    }

    let weirdTokenCount = 0;
    let alphaTokenCount = 0;
    let strongWordCount = 0;
    let shortTokenCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const normalized = this.normalizeFrenchWord(token);
      const letters = this.countLetters(token);
      const digits = this.countDigits(token);

      if (letters >= 3 && digits === 0) {
        alphaTokenCount++;
      }

      if (normalized.length >= 4) {
        strongWordCount++;
      }

      if (normalized.length > 0 && normalized.length <= 2) {
        shortTokenCount++;
      }

      if (normalized.length <= 2 && token.length > 2) {
        weirdTokenCount++;
      }

      if (digits > 0 && letters > 0 && normalized.length <= 3) {
        weirdTokenCount++;
      }
    }

    if ((this.containsSubstring(lower, "qte") ||
         this.containsSubstring(lower, "montant") ||
         this.containsSubstring(lower, "prix") ||
         this.containsSubstring(lower, "designation") ||
         this.containsSubstring(lower, "désignation")) &&
        !this.textHasStrongSupplierAnchor(text)) {
      return true;
    }

    // NEW: Detect obvious OCR garbage patterns
    if (this.containsSubstring(lower, "(&") ||
        this.containsSubstring(lower, "(&)") ||
        this.containsSubstring(lower, "lui tly") ||
        this.containsSubstring(lower, "anthverntiettie") ||
        this.containsSubstring(lower, "scann") ||
        this.containsSubstring(lower, "camscanner")) {
      return true;
    }

    // NEW: Detect lines with excessive special characters
    let parenCount = 0, ampersandCount = 0, pipeCount = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(' || text[i] === ')') parenCount++;
      if (text[i] === '&') ampersandCount++;
      if (text[i] === '|') pipeCount++;
    }
    if (parenCount > 2 || ampersandCount > 1 || pipeCount > 1) {
      if (!this.textHasStrongSupplierAnchor(text)) {
        return true;
      }
    }

    if (strongWordCount < 2 && !this.textHasSupplierAnchor(text)) {
      return true;
    }

    if (tokens.length >= 6 && weirdTokenCount >= Math.ceil(tokens.length * 0.45)) {
      return true;
    }

    if (alphaTokenCount === 0 && !this.textHasSupplierAnchor(text)) {
      return true;
    }

    if (!this.textHasStrongSupplierAnchor(text) &&
        strongWordCount < 4 &&
        weirdTokenCount >= Math.ceil(tokens.length * 0.3)) {
      return true;
    }

    if (!this.textHasStrongSupplierAnchor(text) &&
        tokens.length >= 12 &&
        shortTokenCount >= Math.ceil(tokens.length * 0.25)) {
      return true;
    }

    return false;
  }

  normalizeFrenchWord(word) {
    if (!word) return "";
    let result = "";
    const lower = this.toLowerCaseSafe(word);
    for (let i = 0; i < lower.length; i++) {
      const char = this.normalizeFrenchChar(lower[i]);
      const code = char.charCodeAt(0);
      const isLetter = code >= 97 && code <= 122;
      const isDigit = code >= 48 && code <= 57;
      if (isLetter || isDigit) {
        result += char;
      }
    }
    return result;
  }

  scoreTotalsLineQuality(line, tokens) {
    if (!line) return 0;

    const lower = this.toLowerCaseSafe(line);
    let score = 0;
    const moneyCount = this.countMoneyLikeTokens(tokens || this.tokenize(line));

    if (this.containsAnyKeyword(lower, this.moneyKeywords.ht)) score += 35;
    if (this.containsAnyKeyword(lower, this.moneyKeywords.tva)) score += 35;
    if (this.containsAnyKeyword(lower, this.moneyKeywords.ttc)) score += 35;
    if (this.containsSubstring(lower, "total")) score += 25;
    if (this.containsSubstring(lower, "payer")) score += 20;
    if (this.containsSubstring(lower, "somme")) score += 15;
    if (this.containsSubstring(lower, "reglement")) score += 15;
    if (moneyCount >= 1) score += 15;
    if (moneyCount >= 2) score += 20;

    if (this.containsAnyKeyword(lower, this.excludeKeywords) &&
        !this.containsAnyKeyword(lower, this.moneyKeywords.ht) &&
        !this.containsAnyKeyword(lower, this.moneyKeywords.tva) &&
        !this.containsAnyKeyword(lower, this.moneyKeywords.ttc)) {
      score -= 25;
    }

    return Math.max(0, Math.min(100, score));
  }

  mergeBlockLines(lines) {
    let result = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].cleaned;
      if (result.length > 0) {
        if (!this.shouldConcatenateTightly(result, line)) {
          result += " ";
        }
      }
      result += line;
    }
    return this.normalizeSpaces(this.trimSafe(result));
  }

  shouldConcatenateTightly(existing, nextLine) {
    if (!existing || !nextLine) return false;
    const lastChar = existing[existing.length - 1];
    if (lastChar === '-' || lastChar === '/' || lastChar === '&' || lastChar === '(') {
      return true;
    }

    const nextFirst = nextLine[0];
    return nextFirst === ')' || nextFirst === '/' || nextFirst === ',' || nextFirst === '.';
  }

  countLetters(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        count++;
      }
    }
    return count;
  }

  countSymbols(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const isDigit = code >= 48 && code <= 57;
      const isSpace = code === 32 || code === 9;
      if (!isLetter && !isDigit && !isSpace) {
        count++;
      }
    }
    return count;
  }

  countMoneyLikeTokens(tokens) {
    let count = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (this.looksLikeMoney(tokens[i])) {
        count++;
      }
    }
    return count;
  }

  countDigits(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        count++;
      }
    }
    return count;
  }

  extractDateCandidates(classifiedLines, zones) {
    const candidates = [];
    const seen = {};

    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (lineInfo.lowTrust) continue;
      const classification = lineInfo.classification;

      // Prioritize date-like lines
      if (classification.types.indexOf("date") !== -1) {
        // Skip delivery/expiration dates — we only want the invoice date
        const lineLowerForDelivery = this.toLowerCaseSafe(lineInfo.cleaned || "");
        if (this.containsSubstring(lineLowerForDelivery, "delivraison") ||
            this.containsSubstring(lineLowerForDelivery, "livraison") ||
            this.containsSubstring(lineLowerForDelivery, "echeance") ||
            this.containsSubstring(lineLowerForDelivery, "écheance") ||
            this.containsSubstring(lineLowerForDelivery, "expiration") ||
            this.containsSubstring(lineLowerForDelivery, "validite") ||
            this.containsSubstring(lineLowerForDelivery, "validité")) {
          // continue to next line, don't extract delivery dates as invoice dates
        } else {
        const tokens = lineInfo.tokens.slice();
        const embeddedDates = this.extractDateTokensFromText(lineInfo.cleaned);
        const localizedDates = this.extractFrenchMonthDateTokensFromText(lineInfo.cleaned);

        for (let j = 0; j < embeddedDates.length; j++) {
          tokens.push(embeddedDates[j]);
        }
        for (let j = 0; j < localizedDates.length; j++) {
          tokens.push(localizedDates[j]);
        }

        for (let j = 0; j < tokens.length; j++) {
          const token = tokens[j];

          if (this.looksLikeDate(token)) {
            const parsedDate = this.parseDate(token);
            if (!parsedDate.valid) continue;

            const dedupeKey = token + "|" + i;
            if (seen[dedupeKey]) continue;
            seen[dedupeKey] = true;

            candidates.push({
              value: token,
              parsed: parsedDate,
              lineIndex: i,
              zone: this.getZoneForLine(i, zones),
              context: lineInfo.cleaned,
              reasons: ["matches date pattern", "found in date context"]
            });
          }
        }
        } // end delivery date skip
      }

      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      const normalizedLabel = this.normalizeComparableText(lineInfo.cleaned || "");
      if (this.containsAnyKeyword(lower, this.dateKeywords) && i + 1 < classifiedLines.length) {
        if (normalizedLabel === "du" || normalizedLabel === "au") {
          continue;
        }
        const nextLine = classifiedLines[i + 1];
        if (nextLine && !nextLine.lowTrust) {
          const nextTokens = (nextLine.tokens || []).slice();
          const nextEmbeddedDates = this.extractDateTokensFromText(nextLine.cleaned);
          const nextLocalizedDates = this.extractFrenchMonthDateTokensFromText(nextLine.cleaned);

          for (let j = 0; j < nextEmbeddedDates.length; j++) nextTokens.push(nextEmbeddedDates[j]);
          for (let j = 0; j < nextLocalizedDates.length; j++) nextTokens.push(nextLocalizedDates[j]);

          for (let j = 0; j < nextTokens.length; j++) {
            const token = nextTokens[j];
            if (!this.looksLikeDate(token)) continue;

            const parsedDate = this.parseDate(token);
            if (!parsedDate.valid) continue;

            const dedupeKey = token + "|" + (i + 1);
            if (seen[dedupeKey]) continue;
            seen[dedupeKey] = true;

            candidates.push({
              value: token,
              parsed: parsedDate,
              lineIndex: i + 1,
              zone: this.containsSubstring(lower, "date facture") ? "header" : this.getZoneForLine(i + 1, zones),
              context: lineInfo.cleaned + " " + nextLine.cleaned,
              reasons: [this.containsSubstring(lower, "date facture") ? "found on line after invoice-date label" : "found on line after date label"]
            });
          }
        }
      }
    }

    const stackedHeader = this.extractStackedHeaderFields(classifiedLines, zones);
    for (let i = 0; i < stackedHeader.dateFacture.length; i++) {
      const candidate = stackedHeader.dateFacture[i];
      const dedupeKey = candidate.value + "|" + candidate.lineIndex;
      if (seen[dedupeKey]) continue;
      seen[dedupeKey] = true;
      candidates.push(candidate);
    }

    const factureGrid = this.extractFactureGridHeaderFields(classifiedLines, zones);
    for (let i = 0; i < factureGrid.dateFacture.length; i++) {
      const candidate = factureGrid.dateFacture[i];
      const dedupeKey = candidate.value + "|" + candidate.lineIndex;
      if (seen[dedupeKey]) continue;
      seen[dedupeKey] = true;
      candidates.push(candidate);
    }

    return candidates;
  }

  extractStackedHeaderFields(classifiedLines, zones) {
    const result = {
      numeroFacture: [],
      dateFacture: []
    };

    for (let i = 0; i < Math.min(classifiedLines.length, 20); i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo || lineInfo.lowTrust) continue;

      const labelType = this.detectStackedHeaderLabelType(lineInfo.cleaned);
      if (!labelType || labelType === "skip") continue;

      const singleValueLine = this.findSingleStackedHeaderValueLine(classifiedLines, i, labelType);
      if (singleValueLine) {
        const context = lineInfo.cleaned + " " + singleValueLine.cleaned;

        if (labelType === "numero") {
          const inlineReference = this.extractInvoiceReferenceFromText(singleValueLine.cleaned);
          if (inlineReference && this.isLikelyInvoiceReference(inlineReference, context)) {
            result.numeroFacture.push({
              value: inlineReference,
              lineIndex: singleValueLine.index,
              zone: this.getZoneForLine(singleValueLine.index, zones),
              context,
              reasons: ["mapped from single stacked header label"]
            });
          } else {
            for (let k = 0; k < (singleValueLine.tokens || []).length; k++) {
              const token = this.normalizeReferenceToken(singleValueLine.tokens[k]);
              if (token.length <= 2) continue;
              if (this.looksLikeDate(token)) continue;
              if (!this.isLikelyInvoiceReference(token, context)) continue;

              result.numeroFacture.push({
                value: token,
                lineIndex: singleValueLine.index,
                zone: this.getZoneForLine(singleValueLine.index, zones),
                context,
                reasons: ["mapped from single stacked header label"]
              });
              break;
            }
          }
        } else if (labelType === "date") {
          const tokens = (singleValueLine.tokens || []).slice();
          const embeddedDates = this.extractDateTokensFromText(singleValueLine.cleaned);
          for (let k = 0; k < embeddedDates.length; k++) tokens.push(embeddedDates[k]);

          for (let k = 0; k < tokens.length; k++) {
            const token = tokens[k];
            if (!this.looksLikeDate(token)) continue;
            const parsedDate = this.parseDate(token);
            if (!parsedDate.valid) continue;

            result.dateFacture.push({
              value: token,
              parsed: parsedDate,
              lineIndex: singleValueLine.index,
              zone: this.getZoneForLine(singleValueLine.index, zones),
              context,
              reasons: ["mapped from single stacked header label"]
            });
            break;
          }
        }
      }

      const labelEntries = [];
      let cursor = i;
      while (cursor < Math.min(classifiedLines.length, 25) && labelEntries.length < 8) {
        const current = classifiedLines[cursor];
        if (!current || current.lowTrust) break;

        const currentType = this.detectStackedHeaderLabelType(current.cleaned);
        if (!currentType) break;
        if (currentType === "skip") {
          cursor++;
          continue;
        }

        labelEntries.push({ line: current, type: currentType });
        cursor++;
      }

      if (labelEntries.length < 2) continue;

      const valueEntries = [];
      let valueCursor = cursor;
      while (valueCursor < Math.min(classifiedLines.length, 30) && valueEntries.length < labelEntries.length) {
        const current = classifiedLines[valueCursor];
        if (!current) break;
        const currentType = this.detectStackedHeaderLabelType(current.cleaned);
        if (currentType && currentType !== "skip") break;
        if (this.looksLikeStackedHeaderMetaValue(current.cleaned)) {
          valueCursor++;
          continue;
        }

        const valueTokens = (current.tokens || []).slice();
        const embeddedDates = this.extractDateTokensFromText(current.cleaned);
        for (let k = 0; k < embeddedDates.length; k++) valueTokens.push(embeddedDates[k]);
        const hasUsefulHeaderValue =
          this.extractInvoiceReferenceFromText(current.cleaned) ||
          valueTokens.some(token => this.looksLikeDate(token)) ||
          valueTokens.some(token => this.isLikelyInvoiceReference(this.normalizeReferenceToken(token), current.cleaned));
        if (current.lowTrust && !hasUsefulHeaderValue) {
          valueCursor++;
          continue;
        }

        valueEntries.push(current);
        valueCursor++;
      }

      if (valueEntries.length < labelEntries.length) continue;

      for (let j = 0; j < labelEntries.length && j < valueEntries.length; j++) {
        const label = labelEntries[j];
        const valueLine = valueEntries[j];
        const context = label.line.cleaned + " " + valueLine.cleaned;

        if (label.type === "numero") {
          for (let k = 0; k < valueLine.tokens.length; k++) {
            const token = this.normalizeReferenceToken(valueLine.tokens[k]);
            if (token.length <= 2) continue;
            if (this.looksLikeDate(token)) continue;
            if (!this.isLikelyInvoiceReference(token, context)) continue;

            result.numeroFacture.push({
              value: token,
              lineIndex: valueLine.index,
              zone: this.getZoneForLine(valueLine.index, zones),
              context,
              reasons: ["mapped from stacked header labels"]
            });
            break;
          }
        } else if (label.type === "date") {
          const tokens = (valueLine.tokens || []).slice();
          const embeddedDates = this.extractDateTokensFromText(valueLine.cleaned);
          for (let k = 0; k < embeddedDates.length; k++) tokens.push(embeddedDates[k]);

          for (let k = 0; k < tokens.length; k++) {
            const token = tokens[k];
            if (!this.looksLikeDate(token)) continue;
            const parsedDate = this.parseDate(token);
            if (!parsedDate.valid) continue;

            result.dateFacture.push({
              value: token,
              parsed: parsedDate,
              lineIndex: valueLine.index,
              zone: this.getZoneForLine(valueLine.index, zones),
              context,
              reasons: ["mapped from stacked header labels"]
            });
            break;
          }
        }
      }

      i = valueCursor - 1;
    }

    return result;
  }

  extractFactureGridHeaderFields(classifiedLines, zones) {
    const result = {
      numeroFacture: [],
      dateFacture: []
    };

    for (let i = 0; i < Math.min(classifiedLines.length, 35); i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo) continue;

      const lower = this.toLowerCaseSafe(lineInfo.cleaned || "");
      if (!this.containsSubstring(lower, "facturen") &&
          !this.containsSubstring(lower, "facture n") &&
          !this.containsSubstring(lower, "facture")) {
        continue;
      }

      let hasDateMarker = false;
      let hasDuMarker = false;
      let hasAuMarker = false;
      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 4); j++) {
        const markerLine = classifiedLines[j];
        if (!markerLine) break;
        const markerLower = this.toLowerCaseSafe(markerLine.cleaned || "");
        if (this.containsSubstring(markerLower, "date")) hasDateMarker = true;
        if (markerLower === "du" || this.containsSubstring(markerLower, " du")) hasDuMarker = true;
        if (markerLower === "au" || this.containsSubstring(markerLower, " au")) hasAuMarker = true;
      }

      if (!hasDateMarker) continue;

      const valueDates = [];
      const valueRefs = [];
      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 10); j++) {
        const valueLine = classifiedLines[j];
        if (!valueLine) break;
        const valueLower = this.toLowerCaseSafe(valueLine.cleaned || "");
        if (this.containsSubstring(valueLower, "designation") ||
            this.containsSubstring(valueLower, "identification")) {
          break;
        }

        let exactDateFound = false;
        const tokens = valueLine.tokens || [];
        for (let k = 0; k < tokens.length; k++) {
          if (!this.looksLikeDate(tokens[k])) continue;
          const parsed = this.parseDate(tokens[k]);
          if (parsed && parsed.valid) {
            exactDateFound = true;
            valueDates.push({
              value: tokens[k],
              parsed,
              lineIndex: valueLine.index,
              context: lineInfo.cleaned + " " + valueLine.cleaned
            });
          }
        }

        if (!exactDateFound) {
          const embeddedDates = this.extractDateTokensFromText(valueLine.cleaned || "");
          for (let k = 0; k < embeddedDates.length; k++) {
            const parsed = this.parseDate(embeddedDates[k]);
            if (parsed && parsed.valid) {
              valueDates.push({
                value: embeddedDates[k],
                parsed,
                lineIndex: valueLine.index,
                context: lineInfo.cleaned + " " + valueLine.cleaned
              });
            }
          }
        }

        for (let k = 0; k < tokens.length; k++) {
          const token = this.normalizeReferenceToken(tokens[k]);
          if (token.length < 4 || token.length > 12) continue;
          if (this.looksLikeDate(token)) continue;
          if (this.isLikelyInvoiceReference(token, lineInfo.cleaned + " " + valueLine.cleaned) ||
              this.looksLikePureNumber(token)) {
            valueRefs.push({
              value: token,
              lineIndex: valueLine.index,
              context: lineInfo.cleaned + " " + valueLine.cleaned
            });
          }
        }
      }

      if (valueRefs.length > 0) {
        const reference = valueRefs[0];
        result.numeroFacture.push({
          value: reference.value,
          lineIndex: reference.lineIndex,
          zone: this.getZoneForLine(reference.lineIndex, zones),
          context: reference.context,
          reasons: ["mapped from facture/date grid"]
        });
      }

      if (valueDates.length > 0) {
        let bestDate = valueDates[0];
        let bestScore = -1;
        for (let d = 0; d < valueDates.length; d++) {
          const candidate = valueDates[d];
          const candidateStamp = candidate.parsed.year * 10000 + candidate.parsed.month * 100 + candidate.parsed.day;
          let score = 0;
          let duplicateCount = 0;
          for (let x = 0; x < valueDates.length; x++) {
            const other = valueDates[x];
            const otherStamp = other.parsed.year * 10000 + other.parsed.month * 100 + other.parsed.day;
            if (otherStamp === candidateStamp) duplicateCount++;
          }
          score += duplicateCount * 10;
          if (candidate.parsed && candidate.parsed.valid) score += 15;
          if (hasDuMarker && hasAuMarker && duplicateCount >= 2) score += 20;
          if (hasDuMarker && hasAuMarker) {
            score += candidateStamp / 1000000;
          }
          if (candidate.lineIndex >= i + 3) score += 5;
          if (score > bestScore) {
            bestDate = candidate;
            bestScore = score;
          }
        }

        result.dateFacture.push({
          value: bestDate.value,
          parsed: bestDate.parsed,
          lineIndex: bestDate.lineIndex,
          zone: this.getZoneForLine(bestDate.lineIndex, zones),
          context: bestDate.context,
          reasons: ["mapped from facture/date grid"]
        });
      }

      if (result.numeroFacture.length > 0 || result.dateFacture.length > 0) {
        break;
      }
    }

    return result;
  }

  findSingleStackedHeaderValueLine(classifiedLines, labelIndex, labelType) {
    const maxLookahead = labelType === "date" ? 2 : 3;

    for (let offset = 1; offset <= maxLookahead; offset++) {
      const candidate = classifiedLines[labelIndex + offset];
      if (!candidate) break;

      const candidateType = this.detectStackedHeaderLabelType(candidate.cleaned);
      if (candidateType && candidateType !== "skip") break;
      if (this.looksLikeStackedHeaderMetaValue(candidate.cleaned)) continue;

      const candidateText = candidate.cleaned || "";
      const embeddedDates = this.extractDateTokensFromText(candidateText);

      if (labelType === "date") {
        if (embeddedDates.length > 0) return candidate;

        const tokens = candidate.tokens || [];
        for (let i = 0; i < tokens.length; i++) {
          if (this.looksLikeDate(tokens[i])) {
            return candidate;
          }
        }
        continue;
      }

      const inlineReference = this.extractInvoiceReferenceFromText(candidateText);
      if (inlineReference && this.isLikelyInvoiceReference(inlineReference, candidateText)) {
        return candidate;
      }

      const tokens = candidate.tokens || [];
      for (let i = 0; i < tokens.length; i++) {
        const token = this.normalizeReferenceToken(tokens[i]);
        if (token.length <= 2) continue;
        if (this.looksLikeDate(token)) continue;
        if (this.isLikelyInvoiceReference(token, candidateText)) {
          return candidate;
        }
      }
    }

    return null;
  }

  detectStackedHeaderLabelType(line) {
    const lower = this.toLowerCaseSafe(line || "");
    if (!lower) return null;
    if (this.containsSubstring(lower, "numero")) return "numero";
    if (this.containsSubstring(lower, "facture") &&
        (this.containsSubstring(lower, "n°") ||
         this.containsSubstring(lower, "n ") ||
         this.containsSubstring(lower, " n"))) {
      return "numero";
    }
    if (this.containsSubstring(lower, "date")) return "date";
    if (this.containsSubstring(lower, "page")) return "skip";
    if (this.containsSubstring(lower, "compte")) return "skip";
    if (this.containsSubstring(lower, "reference")) return "skip";
    return null;
  }

  looksLikeStackedHeaderMetaValue(line) {
    const lower = this.toLowerCaseSafe(line || "");
    return this.containsSubstring(lower, "compte") ||
      this.containsSubstring(lower, "reference") ||
      this.containsSubstring(lower, "vosreference");
  }

  extractMoneyCandidates(classifiedLines, zones, blocks) {
    const candidates = {
      ht: [],
      tva: [],
      ttc: []
    };

    // STEP 1: Detect same-line monetary triplets (3 money values where HT + TVA ≈ TTC)
    if (blocks && blocks.length > 0) {
      this.extractMoneyFromTotalsBlocks(blocks, zones, candidates);
    }
    this.detectVatBreakdownTriplets(classifiedLines, zones, candidates);
    this.extractWrittenTotalCandidates(classifiedLines, zones, candidates);
    this.detectFooterTotalsRun(classifiedLines, zones, candidates);
    this.detectGeneralTotalStack(classifiedLines, zones, candidates);
    this.detectNetAPayerTotalsBlock(classifiedLines, zones, candidates);
    this.detectSameLineTriplets(classifiedLines, zones, candidates);

    // STEP 3: Extract money values with type detection from keywords
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (lineInfo.lowTrust) continue;
      const classification = lineInfo.classification;
      const line = lineInfo.cleaned.toLowerCase();
      const tokens = lineInfo.tokens;

      // Extract all money values from this line
      const moneyValues = this.extractMoneyValuesFromLine(lineInfo);

      if (moneyValues.length === 0) continue;

      // Determine type based on classification first, then keywords
      let detectedType = classification.scores ? classification.scores.moneyType : null;

      if (!detectedType) {
        // Try to detect from line content
        const lineLower = line.toLowerCase();
        
        // Check for HT keywords
        for (let k = 0; k < this.moneyKeywords.ht.length; k++) {
          if (this.containsSubstring(lineLower, this.moneyKeywords.ht[k])) {
            detectedType = "ht";
            break;
          }
        }
        
        // Check for TVA keywords
        if (!detectedType) {
          for (let k = 0; k < this.moneyKeywords.tva.length; k++) {
            if (this.containsSubstring(lineLower, this.moneyKeywords.tva[k])) {
              detectedType = "tva";
              break;
            }
          }
        }
        
        // Check for TTC keywords
        if (!detectedType) {
          for (let k = 0; k < this.moneyKeywords.ttc.length; k++) {
            if (this.containsSubstring(lineLower, this.moneyKeywords.ttc[k])) {
              detectedType = "ttc";
              break;
            }
          }
        }

        if (!detectedType &&
            this.containsSubstring(lineLower, "total") &&
            !this.containsAnyKeyword(lineLower, this.moneyKeywords.ht) &&
            !this.containsAnyKeyword(lineLower, this.moneyKeywords.tva) &&
            moneyValues.length > 0) {
          detectedType = "ttc";
        }
      }

      // Assign money values to appropriate categories
      for (let j = 0; j < moneyValues.length; j++) {
        const moneyValue = moneyValues[j];

        const candidate = {
          value: moneyValue.value,
          raw: moneyValue.raw,
          lineIndex: i,
          zone: this.getZoneForLine(i, zones),
          context: lineInfo.cleaned,
          reasons: moneyValue.reasons,
          hasExplicitType: detectedType !== null
        };

        if (detectedType) {
          // Only add if not already added from triplet detection
          const alreadyExists = this.candidateExists(candidates[detectedType], candidate);
          if (!alreadyExists) {
            candidates[detectedType].push(candidate);
          }
        }
      }
    }

	    this.detectAdjacentTypedTotals(classifiedLines, zones, candidates);
	    this.detectStackedTotalsColumns(classifiedLines, zones, candidates);

	    // STEP 3.5: Detect vertical money stacks (HT/TVA/TTC on consecutive lines)
    this.detectVerticalMoneyStacks(classifiedLines, zones, candidates);

    // STEP 4: Detect nearby-line clusters for HT/TVA/TTC
    this.detectNearbyLineClusters(classifiedLines, zones, candidates);

    return candidates;
  }

  detectGeneralTotalStack(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo) continue;

      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      if (!this.containsSubstring(lower, "totalgeneral") &&
          !this.containsSubstring(lower, "total general")) {
        continue;
      }

      const values = [];
      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 8); j++) {
        const nextLine = classifiedLines[j];
        if (!nextLine) continue;

        const nextLower = this.toLowerCaseSafe(nextLine.cleaned);
        if (this.containsSubstring(nextLower, "montant a payer") ||
            this.containsSubstring(nextLower, "montantapayer") ||
            this.containsSubstring(nextLower, "autre mode") ||
            this.containsSubstring(nextLower, "messages") ||
            this.containsSubstring(nextLower, "consommation(kwh)")) {
          break;
        }

        const extracted = this.extractMoneyValuesFromLineWithOptions(nextLine, true);
        if (extracted.length === 0) continue;

        for (let k = 0; k < extracted.length; k++) {
          values.push({
            value: extracted[k].value,
            raw: extracted[k].raw,
            lineIndex: nextLine.index
          });
        }
      }

      if (values.length < 3) continue;

      let mapped = null;
      for (let a = 0; a < values.length; a++) {
        for (let b = 0; b < values.length; b++) {
          if (b === a) continue;
          for (let c = 0; c < values.length; c++) {
            if (c === a || c === b) continue;

            const ht = values[a];
            const tva = values[b];
            const ttc = values[c];
            if (ht.value <= 0 || tva.value < 0 || ttc.value <= ht.value) continue;

            const diff = Math.abs((ht.value + tva.value) - ttc.value);
            const tolerance = Math.max(1, ttc.value * 0.02);
            if (diff > tolerance) continue;

            if (!mapped || ttc.value > mapped.ttc.value) {
              mapped = { ht, tva, ttc };
            }
          }
        }
      }

      if (!mapped) continue;

      const context = [
        lineInfo.cleaned,
        classifiedLines[Math.min(classifiedLines.length - 1, i + 1)] ? classifiedLines[Math.min(classifiedLines.length - 1, i + 1)].cleaned : "",
        String(mapped.ht.raw),
        String(mapped.tva.raw),
        String(mapped.ttc.raw)
      ].join(" ");
      const zone = this.getZoneForLine(mapped.ttc.lineIndex, zones);

      const htCandidate = {
        value: mapped.ht.value,
        raw: mapped.ht.raw,
        lineIndex: mapped.ht.lineIndex,
        zone,
        context,
        reasons: ["general total stack", "HT + TVA = TTC near Total general"],
        hasExplicitType: true
      };
      const tvaCandidate = {
        value: mapped.tva.value,
        raw: mapped.tva.raw,
        lineIndex: mapped.tva.lineIndex,
        zone,
        context,
        reasons: ["general total stack", "HT + TVA = TTC near Total general"],
        hasExplicitType: true
      };
      const ttcCandidate = {
        value: mapped.ttc.value,
        raw: mapped.ttc.raw,
        lineIndex: mapped.ttc.lineIndex,
        zone,
        context,
        reasons: ["general total stack", "HT + TVA = TTC near Total general"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
      if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
      if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
    }
  }

  detectVatBreakdownTriplets(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo || lineInfo.lowTrust) continue;

      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      const isVatBreakdownLine =
        this.containsSubstring(lower, "tva a") ||
        this.containsSubstring(lower, "ventilation des tva");

      if (!isVatBreakdownLine) continue;

      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 2); j++) {
        const nextLine = classifiedLines[j];
        if (!nextLine) continue;

        let values = this.extractMoneyValuesFromLineWithOptions(nextLine, true);
        if (nextLine.tokens && nextLine.tokens.length > 0) {
          for (let k = 0; k < nextLine.tokens.length; k++) {
            const expanded = this.extractVatBreakdownValuesFromToken(nextLine.tokens[k]);
            if (expanded.length === 3) {
              values = [
                { value: expanded[0], raw: nextLine.tokens[k] },
                { value: expanded[1], raw: nextLine.tokens[k] },
                { value: expanded[2], raw: nextLine.tokens[k] }
              ];
              break;
            }
          }
        }
        if (values.length < 3) continue;

        const triplet = this.findConsistentTriplet(values);
        if (!triplet) continue;

        const context = lineInfo.cleaned + " " + nextLine.cleaned;
        const zone = this.getZoneForLine(nextLine.index, zones);

        const htCandidate = {
          value: triplet.ht.value,
          raw: triplet.ht.raw,
          lineIndex: nextLine.index,
          zone,
          context,
          reasons: ["vat breakdown triplet", "explicit TVA schedule"],
          hasExplicitType: true
        };
        const tvaCandidate = {
          value: triplet.tva.value,
          raw: triplet.tva.raw,
          lineIndex: nextLine.index,
          zone,
          context,
          reasons: ["vat breakdown triplet", "explicit TVA schedule"],
          hasExplicitType: true
        };
        const ttcCandidate = {
          value: triplet.ttc.value,
          raw: triplet.ttc.raw,
          lineIndex: nextLine.index,
          zone,
          context,
          reasons: ["vat breakdown triplet", "explicit TVA schedule"],
          hasExplicitType: true
        };

        if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
        if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
        if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
        break;
      }
    }
  }

  findConsistentTriplet(values) {
    if (!values || values.length < 3) return null;

    for (let a = 0; a < values.length; a++) {
      for (let b = 0; b < values.length; b++) {
        if (b === a) continue;
        for (let c = 0; c < values.length; c++) {
          if (c === a || c === b) continue;

          const ht = values[a];
          const tva = values[b];
          const ttc = values[c];
          const expected = ht.value + tva.value;
          const diff = Math.abs(expected - ttc.value);
          const tolerance = Math.max(1, ttc.value * 0.02);

          if (ht.value > 0 && tva.value >= 0 && ttc.value > ht.value && diff <= tolerance) {
            return { ht, tva, ttc };
          }
        }
      }
    }

    return null;
  }

  detectAdjacentTypedTotals(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo) continue;

      const lineLower = this.toLowerCaseSafe(lineInfo.cleaned);
      let detectedType = null;

      if (this.containsAnyKeyword(lineLower, this.moneyKeywords.ht)) {
        detectedType = "ht";
      } else if (this.lineLooksLikeHtLabel(lineInfo.cleaned)) {
        detectedType = "ht";
      } else if (this.containsAnyKeyword(lineLower, this.moneyKeywords.tva)) {
        detectedType = "tva";
      } else if (this.containsAnyKeyword(lineLower, this.moneyKeywords.ttc) ||
          this.hasFinalPayableTotalContext(lineLower) ||
          this.isPlainTotalTtcLabel(lineLower)) {
        detectedType = "ttc";
      }

      if (!detectedType) continue;
      if (lineInfo.lowTrust && detectedType !== "ht") continue;

      const ownMoney = this.extractMoneyValuesFromLine(lineInfo);
      const labelOnlyOrRateLine =
        ownMoney.length === 0 ||
        (detectedType === "tva" && this.lineLooksLikeRateOnly(lineInfo.cleaned, ownMoney)) ||
        (detectedType === "ht" && this.lineLooksLikeHtLabel(lineInfo.cleaned));

      if (!labelOnlyOrRateLine) continue;

      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 2); j++) {
        const nextLine = classifiedLines[j];
        if (!nextLine) continue;

        const nextMoney = this.extractMoneyValuesFromLineWithOptions(nextLine, true);
        if (nextMoney.length === 0) continue;
        if (nextMoney.length === 1 && nextMoney[0].value <= 30) continue;

        let candidateValue = nextMoney[nextMoney.length - 1].value;
        let candidateRaw = nextMoney[nextMoney.length - 1].raw;

        if (detectedType === "tva") {
          const normalizedTva = this.normalizeLikelyTvaAmountFromAdjacentLine(lineInfo.cleaned, nextLine);
          if (normalizedTva !== null) {
            candidateValue = normalizedTva;
            candidateRaw = nextLine.cleaned;
          }
        }

        const candidate = {
          value: candidateValue,
          raw: candidateRaw,
          lineIndex: nextLine.index,
          zone: this.getZoneForLine(nextLine.index, zones),
          context: lineInfo.cleaned + " " + nextLine.cleaned,
          reasons: ["adjacent typed total", "label/value split across lines"],
          hasExplicitType: true
        };

        if (!this.candidateExists(candidates[detectedType], candidate)) {
          candidates[detectedType].push(candidate);
        }
        break;
      }
    }

    // Compact totals stack:
    // 2033,64
    // 203,36
    // 2237,00
    // TOTALTTC
    for (let i = 0; i + 3 < classifiedLines.length; i++) {
      const a = classifiedLines[i];
      const b = classifiedLines[i + 1];
      const c = classifiedLines[i + 2];
      const d = classifiedLines[i + 3];
      if (!a || !b || !c || !d) continue;

      const dLower = this.toLowerCaseSafe(d.cleaned);
      if (!this.containsSubstring(dLower, "totalttc") &&
          !this.containsSubstring(dLower, "totalttc") &&
          !this.containsSubstring(dLower, "total ttc")) {
        continue;
      }

      const ht = this.extractCompactLineAmount(a);
      const tva = this.extractCompactLineAmount(b);
      const ttc = this.extractCompactLineAmount(c);
      if (ht === null || tva === null || ttc === null) continue;
      const diff = Math.abs((ht + tva) - ttc);
      const tolerance = Math.max(1, ttc * 0.03);
      if (diff > tolerance) continue;

      const zone = this.getZoneForLine(c.index, zones);
      const context = a.cleaned + " " + b.cleaned + " " + c.cleaned + " " + d.cleaned;

      const htCandidate = {
        value: ht,
        raw: a.cleaned,
        lineIndex: a.index,
        zone,
        context,
        reasons: ["compact stacked totals", "HT + TVA = TTC"],
        hasExplicitType: true
      };
      const tvaCandidate = {
        value: tva,
        raw: b.cleaned,
        lineIndex: b.index,
        zone,
        context,
        reasons: ["compact stacked totals", "HT + TVA = TTC"],
        hasExplicitType: true
      };
      const ttcCandidate = {
        value: ttc,
        raw: c.cleaned,
        lineIndex: c.index,
        zone,
        context,
        reasons: ["compact stacked totals", "HT + TVA = TTC"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
      if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
      if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
    }

    // Label stack followed by optional prose line and then three amount lines:
    // Total HT
    // TVA
    // Total TTC
    // Mille ...
    // 1596,10
    // 319,22
    // 1915,32 Dh
    for (let i = 0; i + 5 < classifiedLines.length; i++) {
      const htLabel = classifiedLines[i];
      const tvaLabel = classifiedLines[i + 1];
      const ttcLabel = classifiedLines[i + 2];
      if (!htLabel || !tvaLabel || !ttcLabel) continue;

      const htLower = this.toLowerCaseSafe(htLabel.cleaned);
      const tvaLower = this.toLowerCaseSafe(tvaLabel.cleaned);
      const ttcLower = this.toLowerCaseSafe(ttcLabel.cleaned);

      if (!this.containsAnyKeyword(htLower, this.moneyKeywords.ht) &&
          !this.lineLooksLikeHtLabel(htLabel.cleaned)) {
        continue;
      }
      if (!this.containsAnyKeyword(tvaLower, this.moneyKeywords.tva)) continue;
      if (!this.containsAnyKeyword(ttcLower, this.moneyKeywords.ttc) &&
          !this.containsSubstring(ttcLower, "total ttc") &&
          !this.containsSubstring(ttcLower, "totalttc")) {
        continue;
      }

      let amountStart = i + 3;
      while (amountStart < classifiedLines.length && amountStart <= i + 5) {
        const amountLine = classifiedLines[amountStart];
        if (!amountLine) break;
        const values = this.extractMoneyValuesFromLineWithOptions(amountLine, true);
        if (values.length > 0) break;
        amountStart++;
      }

      if (amountStart + 2 >= classifiedLines.length) continue;

      const htLine = classifiedLines[amountStart];
      const tvaLine = classifiedLines[amountStart + 1];
      const ttcLine = classifiedLines[amountStart + 2];
      if (!htLine || !tvaLine || !ttcLine) continue;

      const htValues = this.extractMoneyValuesFromLineWithOptions(htLine, true);
      const tvaValues = this.extractMoneyValuesFromLineWithOptions(tvaLine, true);
      const ttcValues = this.extractMoneyValuesFromLineWithOptions(ttcLine, true);
      if (htValues.length === 0 || tvaValues.length === 0 || ttcValues.length === 0) continue;

      const ht = htValues[htValues.length - 1].value;
      const tva = tvaValues[tvaValues.length - 1].value;
      const ttc = ttcValues[ttcValues.length - 1].value;
      const diff = Math.abs((ht + tva) - ttc);
      const tolerance = Math.max(1, ttc * 0.03);
      if (diff > tolerance) continue;

      const zone = this.getZoneForLine(ttcLine.index, zones);
      const context = [
        htLabel.cleaned,
        tvaLabel.cleaned,
        ttcLabel.cleaned,
        htLine.cleaned,
        tvaLine.cleaned,
        ttcLine.cleaned
      ].join(" ");

      const htCandidate = {
        value: ht,
        raw: htValues[htValues.length - 1].raw,
        lineIndex: htLine.index,
        zone,
        context,
        reasons: ["stacked totals labels", "HT + TVA = TTC"],
        hasExplicitType: true
      };
      const tvaCandidate = {
        value: tva,
        raw: tvaValues[tvaValues.length - 1].raw,
        lineIndex: tvaLine.index,
        zone,
        context,
        reasons: ["stacked totals labels", "HT + TVA = TTC"],
        hasExplicitType: true
      };
      const ttcCandidate = {
        value: ttc,
        raw: ttcValues[ttcValues.length - 1].raw,
        lineIndex: ttcLine.index,
        zone,
        context,
        reasons: ["stacked totals labels", "HT + TVA = TTC"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
      if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
      if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
    }
  }

  detectStackedTotalsColumns(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const startLine = classifiedLines[i];
      if (!startLine || startLine.lowTrust) continue;

      const firstLabelType = this.detectStackedTotalsLabelType(startLine.cleaned);
      if (!firstLabelType || firstLabelType === "skip") continue;

      const labelEntries = [];
      let cursor = i;
      while (cursor < classifiedLines.length && labelEntries.length < 12) {
        const labelLine = classifiedLines[cursor];
        if (!labelLine || labelLine.lowTrust) break;

        const labelType = this.detectStackedTotalsLabelType(labelLine.cleaned);
        if (!labelType) break;
        if (labelType === "skip") {
          cursor++;
          continue;
        }

        labelEntries.push({ line: labelLine, type: labelType });
        cursor++;
      }

      if (labelEntries.length < 3) continue;

      const valueEntries = [];
      let valueCursor = cursor;
      while (valueCursor < classifiedLines.length && valueEntries.length < labelEntries.length + 2) {
        const valueLine = classifiedLines[valueCursor];
        if (!valueLine) break;

        const valueType = this.detectStackedTotalsLabelType(valueLine.cleaned);
        if (valueType && valueType !== "skip") break;

        const values = this.extractMoneyValuesFromLineWithOptions(valueLine, true);
        if (values.length > 0) {
          const candidateValue = values[values.length - 1].value;
          if (candidateValue > 0 && candidateValue <= 30 && this.lineLooksLikeRateOnly(valueLine.cleaned, values)) {
            valueCursor++;
            continue;
          }
          valueEntries.push({
            line: valueLine,
            value: candidateValue,
            raw: values[values.length - 1].raw
          });
        } else if (valueLine.lowTrust) {
          valueCursor++;
          continue;
        }

        valueCursor++;
      }

      if (valueEntries.length < labelEntries.length) continue;

      const mappedHt = this.findMappedTotalsValue(labelEntries, valueEntries, "ht");
      const mappedTva = this.findMappedTotalsValue(labelEntries, valueEntries, "tva");
      const mappedTtc = this.findMappedTotalsValue(labelEntries, valueEntries, "ttc");
      if (!mappedHt || !mappedTva || !mappedTtc) continue;

      const diff = Math.abs((mappedHt.value + mappedTva.value) - mappedTtc.value);
      const tolerance = Math.max(1, mappedTtc.value * 0.03);
      if (diff > tolerance) continue;

      const context = labelEntries.map(entry => entry.line.cleaned)
        .concat(valueEntries.map(entry => entry.line.cleaned))
        .join(" ");
      const zone = this.getZoneForLine(mappedTtc.line.index, zones);

      const htCandidate = {
        value: mappedHt.value,
        raw: mappedHt.raw,
        lineIndex: mappedHt.line.index,
        zone,
        context,
        reasons: ["stacked totals columns", "mapped label/value totals"],
        hasExplicitType: true
      };
      const tvaCandidate = {
        value: mappedTva.value,
        raw: mappedTva.raw,
        lineIndex: mappedTva.line.index,
        zone,
        context,
        reasons: ["stacked totals columns", "mapped label/value totals"],
        hasExplicitType: true
      };
      const ttcCandidate = {
        value: mappedTtc.value,
        raw: mappedTtc.raw,
        lineIndex: mappedTtc.line.index,
        zone,
        context,
        reasons: ["stacked totals columns", "mapped label/value totals"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
      if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
      if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
      i = valueCursor - 1;
    }
  }

  detectStackedTotalsLabelType(line) {
    const lower = this.toLowerCaseSafe(line || "");
    if (!lower) return null;

    if (this.containsSubstring(lower, "total ttc") ||
        this.containsSubstring(lower, "totalttc") ||
        this.containsSubstring(lower, "netapayer") ||
        this.containsSubstring(lower, "net a payer") ||
        this.containsSubstring(lower, "net à payer")) {
      return "ttc";
    }

    if (this.containsSubstring(lower, "base") ||
        this.containsSubstring(lower, "total net ht") ||
        this.containsSubstring(lower, "total brut ht") ||
        this.containsSubstring(lower, "total net") ||
        this.containsAnyKeyword(lower, this.moneyKeywords.ht)) {
      return "ht";
    }

    if (this.containsSubstring(lower, "taxe") ||
        this.containsSubstring(lower, "total tva") ||
        this.containsAnyKeyword(lower, this.moneyKeywords.tva)) {
      return "tva";
    }

    if (this.containsSubstring(lower, "taux") ||
        this.containsSubstring(lower, "remise")) {
      return "skip";
    }

    return null;
  }

  findMappedTotalsValue(labelEntries, valueEntries, targetType) {
    for (let i = 0; i < labelEntries.length && i < valueEntries.length; i++) {
      const labelType = labelEntries[i].type;
      if (labelType !== targetType) continue;
      if (targetType === "ttc") {
        let best = valueEntries[i];
        for (let j = i + 1; j < valueEntries.length; j++) {
          if (valueEntries[j].value > best.value) {
            best = valueEntries[j];
          }
        }
        return best;
      }
      return valueEntries[i];
    }
    return null;
  }

  normalizeLikelyTvaAmountFromAdjacentLine(labelLine, valueLine) {
    if (!valueLine || !valueLine.tokens || valueLine.tokens.length === 0) return null;

    const lowerLabel = this.toLowerCaseSafe(labelLine || "");
    const hasVatRate =
      this.containsSubstring(lowerLabel, "20%") ||
      this.containsSubstring(lowerLabel, "10%") ||
      this.containsSubstring(lowerLabel, "7%") ||
      this.containsSubstring(lowerLabel, "14%");

    if (!hasVatRate) return null;

    for (let i = 0; i < valueLine.tokens.length; i++) {
      const token = valueLine.tokens[i];
      if (!this.looksLikePureNumber(token)) continue;
      if (token.length < 4 || token.length > 6) continue;

      const scaled = parseInt(token, 10) / 100;
      if (scaled >= 1 && scaled <= 10000) {
        return Math.round(scaled * 100) / 100;
      }
    }

    return null;
  }

  extractCompactLineAmount(lineInfo) {
    if (!lineInfo || !lineInfo.cleaned) return null;

    let compact = "";
    for (let i = 0; i < lineInfo.cleaned.length; i++) {
      const char = lineInfo.cleaned[i];
      const code = char.charCodeAt(0);
      const isDigit = code >= 48 && code <= 57;
      if (isDigit || char === ',' || char === '.') {
        compact += char;
      }
    }

    if (!compact) return null;

    const direct = this.parseMoneyValue(compact);
    if (direct !== null && direct > 0) {
      return direct;
    }

    if (lineInfo.tokens && lineInfo.tokens.length === 2 &&
        this.looksLikePureNumber(lineInfo.tokens[0]) &&
        this.looksLikeMoney(lineInfo.tokens[1])) {
      const joinedValue = this.parseMoneyValue(lineInfo.tokens[0] + lineInfo.tokens[1]);
      if (joinedValue !== null && joinedValue > 0) {
        return joinedValue;
      }
    }

    return null;
  }

  lineLooksLikeRateOnly(line, ownMoney) {
    const lower = this.toLowerCaseSafe(line || "");
    if (this.containsSubstring(lower, "%")) {
      if (!ownMoney || ownMoney.length === 0) return true;

      let maxValue = 0;
      for (let i = 0; i < ownMoney.length; i++) {
        const value = ownMoney[i] && typeof ownMoney[i].value === "number" ? ownMoney[i].value : 0;
        if (value > maxValue) maxValue = value;
      }

      if (ownMoney.length > 1 || maxValue > 30) return false;
      return true;
    }
    if (!ownMoney || ownMoney.length === 0) return false;
    return ownMoney.length === 1 && ownMoney[0].value > 0 && ownMoney[0].value <= 30;
  }

  lineLooksLikeHtLabel(line) {
    const lower = this.toLowerCaseSafe(line || "");
    return this.containsAnyKeyword(lower, this.moneyKeywords.ht) ||
      lower === "h" ||
      lower === "h:" ||
      lower === "h :" ||
      this.containsSubstring(lower, "11t") ||
      this.containsSubstring(lower, "i1t") ||
      this.containsSubstring(lower, "l1t") ||
      this.containsSubstring(lower, "1ht") ||
      this.containsSubstring(lower, "iht");
  }

  isPlainTotalTtcLabel(line) {
    const lower = this.toLowerCaseSafe(line || "");
    if (!this.containsSubstring(lower, "total")) return false;
    if (this.containsAnyKeyword(lower, this.moneyKeywords.ht)) return false;
    if (this.containsAnyKeyword(lower, this.moneyKeywords.tva)) return false;
    if (this.containsSubstring(lower, "sous-total") || this.containsSubstring(lower, "sous total")) return false;
    return true;
  }

  extractWrittenTotalCandidates(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo || lineInfo.lowTrust) continue;

      let targetLine = lineInfo.cleaned;
      let sourceIndex = lineInfo.index;
      const lower = this.toLowerCaseSafe(lineInfo.cleaned);

      const announcesWrittenTotal =
        this.containsSubstring(lower, "arr") ||
        this.containsSubstring(lower, "somme") ||
        this.containsSubstring(lower, "dirham");
      const hasCurrencyWord =
        this.containsSubstring(lower, "dirham") ||
        this.containsSubstring(lower, "dhs");

      if (announcesWrittenTotal && i + 1 < classifiedLines.length && !classifiedLines[i + 1].lowTrust) {
        const nextLower = this.toLowerCaseSafe(classifiedLines[i + 1].cleaned);
        if (this.containsSubstring(nextLower, "dirham") || this.containsFrenchNumberWords(nextLower)) {
          targetLine = classifiedLines[i + 1].cleaned;
          sourceIndex = classifiedLines[i + 1].index;
        }
      }

      if (!announcesWrittenTotal && !hasCurrencyWord) {
        continue;
      }

      const parsed = this.parseFrenchAmountWords(targetLine);
      if (parsed === null || parsed <= 0) continue;

      const candidate = {
        value: parsed,
        raw: targetLine,
        lineIndex: sourceIndex,
        zone: this.getZoneForLine(sourceIndex, zones),
        context: targetLine,
        reasons: ["written total amount", "parsed from French number words"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ttc, candidate)) {
        candidates.ttc.push(candidate);
      }
    }
  }

  extractMoneyFromTotalsBlocks(blocks, zones, candidates) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block || !block.lines || block.lines.length === 0) continue;
      if (block.zone === "header") continue;
      if (!block.profile.hasTotals && !block.profile.totalsLike) continue;

      for (let j = 0; j < block.lines.length; j++) {
        const typed = this.extractTypedMoneyFromLine(block.lines[j], zones);
        if (!typed) continue;

        if (typed.ht && !this.candidateExists(candidates.ht, typed.ht)) {
          candidates.ht.push(typed.ht);
        }

        if (typed.tva && !this.candidateExists(candidates.tva, typed.tva)) {
          candidates.tva.push(typed.tva);
        }

        if (typed.ttc && !this.candidateExists(candidates.ttc, typed.ttc)) {
          candidates.ttc.push(typed.ttc);
        }
      }
    }
  }

  detectFooterTotalsRun(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo) continue;
      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      if (!this.containsSubstring(lower, "total net ht")) continue;

      let tvaLabel = -1;
      let ttcLabel = -1;
      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 8); j++) {
        const nextLower = this.toLowerCaseSafe(classifiedLines[j] ? classifiedLines[j].cleaned : "");
        if (tvaLabel === -1 && this.containsSubstring(nextLower, "total tva")) {
          tvaLabel = j;
        }
        if (ttcLabel === -1 &&
            (this.containsSubstring(nextLower, "net a payer") ||
             this.containsSubstring(nextLower, "net Ã  payer") ||
             this.containsSubstring(nextLower, "total ttc"))) {
          ttcLabel = j;
        }
      }

      if (tvaLabel === -1 || ttcLabel === -1) continue;

      const values = [];
      for (let j = ttcLabel + 1; j <= Math.min(classifiedLines.length - 1, ttcLabel + 12); j++) {
        const valueLine = classifiedLines[j];
        if (!valueLine) continue;
        const valueLower = this.toLowerCaseSafe(valueLine.cleaned);
        if (this.containsSubstring(valueLower, "facture arretee") ||
            this.containsSubstring(valueLower, "conditions") ||
            this.containsSubstring(valueLower, "mode de paiement")) {
          break;
        }

        const extracted = this.extractMoneyValuesFromLineWithOptions(valueLine, true);
        if (extracted.length === 0) continue;
        const candidateValue = extracted[extracted.length - 1].value;
        if (candidateValue <= 0) continue;
        if (candidateValue <= 30 && this.lineLooksLikeRateOnly(valueLine.cleaned, extracted)) continue;

        values.push({
          value: candidateValue,
          raw: extracted[extracted.length - 1].raw,
          lineIndex: valueLine.index
        });
      }

      if (values.length < 3) continue;

      const ht = values[0];
      let ttc = values[0];
      for (let j = 1; j < values.length; j++) {
        if (values[j].value > ttc.value) ttc = values[j];
      }

      let tva = null;
      const expectedTva = Math.round((ttc.value - ht.value) * 100) / 100;
      for (let j = 1; j < values.length; j++) {
        const diff = Math.abs(values[j].value - expectedTva);
        if (diff <= Math.max(1, ttc.value * 0.03)) {
          tva = values[j];
          break;
        }
      }

      if (!tva) continue;

      const context = [
        classifiedLines[i].cleaned,
        classifiedLines[tvaLabel].cleaned,
        classifiedLines[ttcLabel].cleaned
      ].concat(values.slice(0, 6).map(entry => String(entry.raw))).join(" ");
      const zone = this.getZoneForLine(ttc.lineIndex, zones);

      const htCandidate = {
        value: ht.value,
        raw: ht.raw,
        lineIndex: ht.lineIndex,
        zone,
        context,
        reasons: ["footer totals run", "explicit net/tva/payable labels"],
        hasExplicitType: true
      };
      const tvaCandidate = {
        value: tva.value,
        raw: tva.raw,
        lineIndex: tva.lineIndex,
        zone,
        context,
        reasons: ["footer totals run", "explicit net/tva/payable labels"],
        hasExplicitType: true
      };
      const ttcCandidate = {
        value: ttc.value,
        raw: ttc.raw,
        lineIndex: ttc.lineIndex,
        zone,
        context,
        reasons: ["footer totals run", "explicit net/tva/payable labels"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
      if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
      if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
    }
  }

  detectNetAPayerTotalsBlock(classifiedLines, zones, candidates) {
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (!lineInfo) continue;

      const lower = this.toLowerCaseSafe(lineInfo.cleaned || "");
      if (!this.containsSubstring(lower, "netapayer") &&
          !this.containsSubstring(lower, "net a payer")) {
        continue;
      }

      const values = [];
      for (let j = i + 1; j <= Math.min(classifiedLines.length - 1, i + 10); j++) {
        const nextLine = classifiedLines[j];
        if (!nextLine) continue;
        const nextLower = this.toLowerCaseSafe(nextLine.cleaned || "");

        if (this.isTotalsFooterBoundaryLine(nextLine)) {
          if (values.length > 0) break;
          continue;
        }

        if (this.containsSubstring(nextLower, "arretee la presente facture") ||
            this.containsSubstring(nextLower, "arrtee la presente facture") ||
            this.containsSubstring(nextLower, "arretee") ||
            this.containsSubstring(nextLower, "presente facture a la somme") ||
            this.containsSubstring(nextLower, "a la somme de")) {
          break;
        }

        const extracted = this.extractMoneyValuesFromLineWithOptions(nextLine, true);
        if (extracted.length === 0) continue;
        for (let k = 0; k < extracted.length; k++) {
          if (extracted[k].value <= 0) continue;
          values.push({
            value: extracted[k].value,
            raw: extracted[k].raw,
            lineIndex: nextLine.index
          });
        }
      }

      if (values.length < 3) continue;

      let best = null;
      let bestScore = -1;
      for (let a = 0; a < values.length; a++) {
        for (let b = 0; b < values.length; b++) {
          if (b === a) continue;
          for (let c = 0; c < values.length; c++) {
            if (c === a || c === b) continue;

            const ht = values[a];
            const tva = values[b];
            const ttc = values[c];
            if (!this.isPlausibleMoneyCombination(ht.value, tva.value, ttc.value)) continue;

            const diff = Math.abs((ht.value + tva.value) - ttc.value);
            const tolerance = Math.max(1, ttc.value * 0.01);
            if (diff > tolerance) continue;

            let score = ttc.value;
            if (diff === 0) score += 10000;
            if (tva.value > 0 && tva.value < ttc.value * 0.2) score += 500;
            if (ht.value > tva.value) score += 200;

            if (score > bestScore) {
              best = { ht, tva, ttc };
              bestScore = score;
            }
          }
        }
      }

      if (!best) continue;

      const zone = this.getZoneForLine(best.ttc.lineIndex, zones);
      const context = [lineInfo.cleaned, String(best.ht.raw), String(best.tva.raw), String(best.ttc.raw)].join(" ");

      const htCandidate = {
        value: best.ht.value,
        raw: best.ht.raw,
        lineIndex: best.ht.lineIndex,
        zone,
        context,
        reasons: ["net a payer totals block", "HT + TVA = TTC near NET A PAYER"],
        hasExplicitType: true
      };
      const tvaCandidate = {
        value: best.tva.value,
        raw: best.tva.raw,
        lineIndex: best.tva.lineIndex,
        zone,
        context,
        reasons: ["net a payer totals block", "HT + TVA = TTC near NET A PAYER"],
        hasExplicitType: true
      };
      const ttcCandidate = {
        value: best.ttc.value,
        raw: best.ttc.raw,
        lineIndex: best.ttc.lineIndex,
        zone,
        context,
        reasons: ["net a payer totals block", "HT + TVA = TTC near NET A PAYER"],
        hasExplicitType: true
      };

      if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
      if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
      if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
    }
  }

  isTotalsFooterBoundaryLine(lineInfo) {
    if (!lineInfo || !lineInfo.cleaned) return false;

    const text = lineInfo.cleaned;
    const lower = this.toLowerCaseSafe(text);
    const hasStrongAdminSignal =
      this.containsPhonePattern(text) ||
      this.containsEmailPattern(text) ||
      this.containsSubstring(lower, "fax") ||
      this.containsSubstring(lower, "tel") ||
      this.containsSubstring(lower, "email") ||
      this.containsSubstring(lower, "route") ||
      this.containsSubstring(lower, "cnss") ||
      this.containsSubstring(lower, "patente") ||
      this.containsSubstring(lower, "rc:") ||
      this.containsSubstring(lower, "r.c") ||
      this.containsSubstring(lower, "i.c.e") ||
      this.containsSubstring(lower, "capital");

    if (!hasStrongAdminSignal) return false;

    const hasTotalsSignal =
      this.hasFinalPayableTotalContext(lower) ||
      this.containsAnyKeyword(lower, this.moneyKeywords.ht || []) ||
      this.containsAnyKeyword(lower, this.moneyKeywords.tva || []) ||
      this.containsAnyKeyword(lower, this.moneyKeywords.ttc || []);

    return !hasTotalsSignal;
  }

  detectVerticalMoneyStacks(classifiedLines, zones, candidates) {
    // Detect vertical stacks where HT, TVA, TTC are on consecutive lines
    // Pattern example:
    //   Total HT              1200,00
    //   TVA 20%                240,00
    //   Total TTC             1440,00
    //
    // Or even without keywords:
    //   1200,00
    //   240,00
    //   1440,00
    //   TOTAL TTC

    for (let i = 0; i < classifiedLines.length - 2; i++) {
      const line1 = classifiedLines[i];
      const line2 = classifiedLines[i + 1];
      const line3 = classifiedLines[i + 2];

      if (!line1 || !line2 || !line3) continue;
      if (line1.lowTrust || line2.lowTrust || line3.lowTrust) continue;

      const zone1 = this.getZoneForLine(i, zones);
      const zone2 = this.getZoneForLine(i + 1, zones);
      const zone3 = this.getZoneForLine(i + 2, zones);

      // Skip if not in footer/body zone
      if (zone1 === "header" && zone2 === "header" && zone3 === "header") continue;

      const money1 = this.extractMoneyValuesFromLine(line1);
      const money2 = this.extractMoneyValuesFromLine(line2);
      const money3 = this.extractMoneyValuesFromLine(line3);

      // Need at least one money value per line
      if (money1.length === 0 || money2.length === 0 || money3.length === 0) continue;

      // Get the last (rightmost) money value from each line (usually the total)
      const val1 = money1[money1.length - 1].value;
      const val2 = money2[money2.length - 1].value;
      const val3 = money3[money3.length - 1].value;

      const line1Lower = this.toLowerCaseSafe(line1.cleaned);
      const line2Lower = this.toLowerCaseSafe(line2.cleaned);
      const line3Lower = this.toLowerCaseSafe(line3.cleaned);

      // Try to identify which is HT, TVA, TTC based on keywords and values
      let ht = null, tva = null, ttc = null;
      let htLine = null, tvaLine = null, ttcLine = null;

      // Check for explicit keywords
      const hasHtKeyword = this.containsAnyKeyword(line1Lower, this.moneyKeywords.ht) ||
                          this.containsAnyKeyword(line2Lower, this.moneyKeywords.ht) ||
                          this.containsAnyKeyword(line3Lower, this.moneyKeywords.ht);
      const hasTvaKeyword = this.containsAnyKeyword(line1Lower, this.moneyKeywords.tva) ||
                           this.containsAnyKeyword(line2Lower, this.moneyKeywords.tva) ||
                           this.containsAnyKeyword(line3Lower, this.moneyKeywords.tva);
      const hasTtcKeyword = this.containsAnyKeyword(line3Lower, this.moneyKeywords.ttc) ||
                           this.containsSubstring(line3Lower, "total") ||
                           this.containsSubstring(line3Lower, "net a payer");

      // Assume order: HT (top), TVA (middle), TTC (bottom)
      // Validate: val1 + val2 ≈ val3
      const expectedTtc = val1 + val2;
      const diff = Math.abs(expectedTtc - val3);
      const tolerance = Math.max(1, val3 * 0.05);

      if (diff <= tolerance && val1 > 0 && val2 >= 0 && val3 > val1) {
        // Valid triplet pattern found
        ht = val1;
        tva = val2;
        ttc = val3;
        htLine = i;
        tvaLine = i + 1;
        ttcLine = i + 2;
      } else {
        // Try alternative: maybe line2 is TTC and line3 is something else
        // Or line1 is just a label and line2/3 are HT/TTC
        const altDiff = Math.abs((val1 + val3) - val2);
        if (altDiff <= tolerance && val1 > 0 && val3 >= 0 && val2 > val1) {
          ht = val1;
          tva = val3;
          ttc = val2;
          htLine = i;
          tvaLine = i + 2;
          ttcLine = i + 1;
        }
      }

      if (ht !== null && tva !== null && ttc !== null) {
        const context = line1.cleaned + " | " + line2.cleaned + " | " + line3.cleaned;

        const htCandidate = {
          value: ht,
          raw: String(ht),
          lineIndex: htLine,
          zone: this.getZoneForLine(htLine, zones),
          context,
          reasons: ["vertical money stack", "HT + TVA ≈ TTC"],
          hasExplicitType: hasHtKeyword
        };

        const tvaCandidate = {
          value: tva,
          raw: String(tva),
          lineIndex: tvaLine,
          zone: this.getZoneForLine(tvaLine, zones),
          context,
          reasons: ["vertical money stack", "HT + TVA ≈ TTC"],
          hasExplicitType: hasTvaKeyword
        };

        const ttcCandidate = {
          value: ttc,
          raw: String(ttc),
          lineIndex: ttcLine,
          zone: this.getZoneForLine(ttcLine, zones),
          context,
          reasons: ["vertical money stack", "HT + TVA ≈ TTC"],
          hasExplicitType: hasTtcKeyword
        };

        if (!this.candidateExists(candidates.ht, htCandidate)) candidates.ht.push(htCandidate);
        if (!this.candidateExists(candidates.tva, tvaCandidate)) candidates.tva.push(tvaCandidate);
        if (!this.candidateExists(candidates.ttc, ttcCandidate)) candidates.ttc.push(ttcCandidate);
      }
    }
  }

  extractTypedMoneyFromLine(lineInfo, zones) {
    if (!lineInfo || lineInfo.lowTrust) return null;

    const lineLower = this.toLowerCaseSafe(lineInfo.cleaned);
    const moneyValues = this.extractMoneyValuesFromLine(lineInfo);
    if (moneyValues.length === 0) return null;

    const zone = this.getZoneForLine(lineInfo.index, zones);
    const base = {
      lineIndex: lineInfo.index,
      zone,
      context: lineInfo.cleaned,
      hasExplicitType: true
    };

    let result = null;

    if (this.containsAnyKeyword(lineLower, this.moneyKeywords.ht)) {
      result = result || {};
      result.ht = {
        ...base,
        value: moneyValues[0].value,
        raw: moneyValues[0].raw,
        reasons: ["totals block", "explicit HT line"]
      };
    }

    if (this.containsAnyKeyword(lineLower, this.moneyKeywords.tva)) {
      result = result || {};
      result.tva = {
        ...base,
        value: moneyValues[moneyValues.length - 1].value,
        raw: moneyValues[moneyValues.length - 1].raw,
        reasons: ["totals block", "explicit TVA line"]
      };
    }

    if (this.containsAnyKeyword(lineLower, this.moneyKeywords.ttc) ||
        this.hasFinalPayableTotalContext(lineLower) ||
        this.isPlainTotalTtcLabel(lineLower) ||
        (this.containsSubstring(lineLower, "total") &&
         !this.containsAnyKeyword(lineLower, this.moneyKeywords.ht) &&
         !this.containsAnyKeyword(lineLower, this.moneyKeywords.tva))) {
      result = result || {};
      result.ttc = {
        ...base,
        value: moneyValues[moneyValues.length - 1].value,
        raw: moneyValues[moneyValues.length - 1].raw,
        reasons: ["totals block", "explicit TTC/total line"]
      };
    }

    return result;
  }

  detectSameLineTriplets(classifiedLines, zones, candidates) {
    // Look for lines with 3 money values that form a valid triplet
    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (lineInfo.lowTrust) continue;
      const lowerContext = this.toLowerCaseSafe(lineInfo.cleaned);
      if (this.containsSubstring(lowerContext, "ice") ||
          this.containsSubstring(lowerContext, "patente") ||
          this.containsSubstring(lowerContext, "identifiant fiscal") ||
          this.containsSubstring(lowerContext, "tel") ||
          this.containsSubstring(lowerContext, "fax") ||
          this.containsSubstring(lowerContext, "capital")) {
        continue;
      }
      const moneyValues = this.extractMoneyValuesFromLine(lineInfo);

      if (moneyValues.length < 3) continue;

      // Try all combinations of 3 values
      for (let a = 0; a < moneyValues.length; a++) {
        for (let b = 0; b < moneyValues.length; b++) {
          if (b === a) continue;
          for (let c = 0; c < moneyValues.length; c++) {
            if (c === a || c === b) continue;

            const ht = moneyValues[a];
            const tva = moneyValues[b];
            const ttc = moneyValues[c];

            // Check if HT + TVA ≈ TTC (within 5% tolerance)
            const expected = ht.value + tva.value;
            const diff = Math.abs(expected - ttc.value);
            const tolerance = Math.max(1, ttc.value * 0.05);

            if (diff <= tolerance && ht.value < ttc.value) {
              // Found a valid triplet on the same line!
              const baseCandidate = {
                lineIndex: i,
                zone: this.getZoneForLine(i, zones),
                context: lineInfo.cleaned,
                reasons: ["same-line triplet", "HT + TVA ≈ TTC"]
              };

              // Add HT candidate
              const htCandidate = {
                ...baseCandidate,
                value: ht.value,
                raw: ht.raw,
                hasExplicitType: true
              };
              if (!this.candidateExists(candidates.ht, htCandidate)) {
                candidates.ht.push(htCandidate);
              }

              // Add TVA candidate
              const tvaCandidate = {
                ...baseCandidate,
                value: tva.value,
                raw: tva.raw,
                hasExplicitType: true
              };
              if (!this.candidateExists(candidates.tva, tvaCandidate)) {
                candidates.tva.push(tvaCandidate);
              }

              // Add TTC candidate
              const ttcCandidate = {
                ...baseCandidate,
                value: ttc.value,
                raw: ttc.raw,
                hasExplicitType: true
              };
              if (!this.candidateExists(candidates.ttc, ttcCandidate)) {
                candidates.ttc.push(ttcCandidate);
              }

              return; // Found triplet, exit
            }
          }
        }
      }
    }
  }

  detectNearbyLineClusters(classifiedLines, zones, candidates) {
    // Look for clusters of lines where HT/TVA/TTC are on nearby lines
    // Example pattern:
    //   Location voiture 3 jours 900,00
    //   TVA : 180,00
    //   TOTAL : 1080,00

    for (let i = 0; i < classifiedLines.length; i++) {
      const lineInfo = classifiedLines[i];
      if (lineInfo.lowTrust) continue;
      const candidateZone = this.getZoneForLine(i, zones);
      if (candidateZone === "header") continue;

      const lineLower = this.toLowerCaseSafe(lineInfo.cleaned);
      if (this.containsAnyKeyword(lineLower, this.excludeKeywords) ||
          this.containsSubstring(lineLower, "client")) {
        continue;
      }

      const moneyValues = this.extractMoneyValuesFromLine(lineInfo);
      
      if (moneyValues.length === 0) continue;

      // Check nearby lines (within 3 lines) for TVA and TOTAL keywords
      const searchRange = 3;
      let hasTvaNearby = false;
      let hasTotalNearby = false;
      let tvaValue = null;
      let totalValue = null;
      let tvaLineIndex = -1;
      let totalLineIndex = -1;

      for (let j = Math.max(0, i - searchRange); j <= Math.min(classifiedLines.length - 1, i + searchRange); j++) {
        if (j === i) continue;
        if (classifiedLines[j].lowTrust) continue;
        
        const nearbyLine = classifiedLines[j].cleaned.toLowerCase();
        const nearbyMoney = this.extractMoneyValuesFromLine(classifiedLines[j]);

        if (this.containsAnyKeyword(nearbyLine, this.moneyKeywords.tva)) {
          hasTvaNearby = true;
          if (nearbyMoney.length > 0) {
            tvaValue = nearbyMoney[0].value;
            tvaLineIndex = j;
          }
        }

        if (this.containsAnyKeyword(nearbyLine, this.moneyKeywords.ttc) || 
            this.containsAnyKeyword(nearbyLine, ["total", "net a payer", "net à payer"])) {
          hasTotalNearby = true;
          if (nearbyMoney.length > 0) {
            totalValue = nearbyMoney[0].value;
            totalLineIndex = j;
          }
        }
      }

      // If this line has a money value and nearby lines have TVA/TOTAL,
      // consider this value as potential HT
      if (moneyValues.length > 0 && (hasTvaNearby || hasTotalNearby)) {
        const htCandidate = {
          value: moneyValues[0].value,
          raw: moneyValues[0].raw,
          lineIndex: i,
          zone: candidateZone,
          context: lineInfo.cleaned,
          reasons: ["nearby-line cluster", "TVA/TOTAL found nearby"],
          hasExplicitType: false
        };

        if (!this.candidateExists(candidates.ht, htCandidate)) {
          candidates.ht.push(htCandidate);
        }
      }

      // Add TVA candidate if found nearby
      if (hasTvaNearby && tvaValue !== null) {
        const tvaCandidate = {
          value: tvaValue,
          raw: String(tvaValue),
          lineIndex: tvaLineIndex,
          zone: this.getZoneForLine(tvaLineIndex, zones),
          context: classifiedLines[tvaLineIndex].cleaned,
          reasons: ["nearby-line cluster", "TVA keyword detected"],
          hasExplicitType: true
        };

        if (!this.candidateExists(candidates.tva, tvaCandidate)) {
          candidates.tva.push(tvaCandidate);
        }
      }

      // Add TTC candidate if found nearby
      if (hasTotalNearby && totalValue !== null) {
        const ttcCandidate = {
          value: totalValue,
          raw: String(totalValue),
          lineIndex: totalLineIndex,
          zone: this.getZoneForLine(totalLineIndex, zones),
          context: classifiedLines[totalLineIndex].cleaned,
          reasons: ["nearby-line cluster", "TOTAL keyword detected"],
          hasExplicitType: true
        };

        if (!this.candidateExists(candidates.ttc, ttcCandidate)) {
          candidates.ttc.push(ttcCandidate);
        }
      }
    }
  }

  candidateExists(list, candidate) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].value === candidate.value && list[i].lineIndex === candidate.lineIndex) {
        return true;
      }
    }
    return false;
  }

  extractMoneyValuesFromLine(lineInfo) {
    return this.extractMoneyValuesFromLineWithOptions(lineInfo, false);
  }

  extractMoneyValuesFromLineWithOptions(lineInfo, allowLowTrust) {
    const moneyValues = [];
    if (!lineInfo || (lineInfo.lowTrust && !allowLowTrust)) return moneyValues;
    const tokens = lineInfo.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      const expanded = this.extractMoneyValuesFromToken(token);
      for (let j = 0; j < expanded.length; j++) {
        const value = expanded[j];
        if (value !== null && value > 0) {
          moneyValues.push({
            value,
            raw: token,
            reasons: expanded.length > 1
              ? ["split merged OCR amount", "valid decimal format"]
              : ["looks like monetary value", "valid decimal format"]
          });
        }
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      if (!this.looksLikeMoney(tokens[i])) continue;

      const joinedValue = this.tryParseJoinedMoneyTokens(tokens, i);
      if (joinedValue === null) continue;

      let exists = false;
      for (let j = 0; j < moneyValues.length; j++) {
        if (Math.abs(moneyValues[j].value - joinedValue) < 0.01) {
          exists = true;
          break;
        }
      }

      if (exists) continue;

      moneyValues.push({
        value: joinedValue,
        raw: tokens[i],
        reasons: ["joined spaced money token", "valid decimal format"]
      });
    }

    return moneyValues;
  }

  extractMoneyValuesFromToken(token) {
    if (!token) return [];

    const compact = this.normalizeMoneyToken(token);
    if (!compact) return [];

    if (this.containsSubstring(compact, "%")) {
      const percentIndex = compact.lastIndexOf("%");
      const trailingChunk = percentIndex !== -1 ? compact.slice(percentIndex + 1) : "";
      if (trailingChunk) {
        const parsedTrailing = this.parseMoneyValue(trailingChunk);
        if (parsedTrailing !== null && parsedTrailing > 0) {
          return [parsedTrailing];
        }
      }
    }

    const vatBreakdownValues = this.extractVatBreakdownValuesFromToken(compact);
    if (vatBreakdownValues.length === 3) {
      return vatBreakdownValues;
    }

    const splitValues = this.splitMergedMoneyToken(compact);
    if (splitValues.length > 0) {
      return splitValues;
    }

    if (this.looksLikeMoney(token)) {
      const parsed = this.parseMoneyValue(token);
      return parsed !== null ? [parsed] : [];
    }

    if (compact !== token && this.looksLikeMoney(compact)) {
      const parsedCompact = this.parseMoneyValue(compact);
      return parsedCompact !== null ? [parsedCompact] : [];
    }

    return [];
  }

  normalizeMoneyToken(token) {
    let result = "";
    for (let i = 0; i < token.length; i++) {
      const char = token[i];
      const code = char.charCodeAt(0);
      const isDigit = code >= 48 && code <= 57;
      if (isDigit || char === ',' || char === '.' || char === '%') {
        result += char;
      }
    }
    return result;
  }

  tryParseJoinedMoneyTokens(tokens, moneyIndex) {
    if (!tokens || moneyIndex < 0 || moneyIndex >= tokens.length) return null;

    let joined = tokens[moneyIndex];
    let consumedPrefix = false;

    for (let i = moneyIndex - 1; i >= 0; i--) {
      const token = tokens[i];
      if (!this.looksLikePureNumber(token)) break;
      if (token.length < 1 || token.length > 3) break;
      joined = token + joined;
      consumedPrefix = true;
    }

    if (!consumedPrefix) return null;

    const parsed = this.parseMoneyValue(joined);
    if (parsed === null || parsed <= 0) return null;
    return parsed;
  }

  splitMergedMoneyToken(token) {
    if (!token) return [];
    if (this.containsSubstring(token, "%")) return [];

    const values = [];
    let remaining = token;

    while (remaining.length > 0) {
      const slice = this.extractTrailingMoneyPart(remaining);
      if (!slice) break;
      values.unshift(slice.value);
      remaining = remaining.slice(0, slice.start);
    }

    if (values.length <= 1) return [];
    return values;
  }

  extractVatBreakdownValuesFromToken(token) {
    const compact = this.normalizeMoneyToken(token);
    if (!compact || this.containsSubstring(compact, "%")) return [];

    const last = this.extractTrailingMoneyPart(compact);
    if (!last) return [];

    const withoutLast = compact.slice(0, last.start);
    const ttc = last.value;

    for (let decimals = 4; decimals >= 2; decimals--) {
      for (let intDigits = 4; intDigits >= 1; intDigits--) {
        const length = intDigits + 1 + decimals;
        const start = withoutLast.length - length;
        if (start < 0) continue;

        const sep = withoutLast[start + intDigits];
        if (sep !== ',' && sep !== '.') continue;

        let valid = true;
        for (let i = start; i < start + intDigits; i++) {
          if (!this.isDigitChar(withoutLast[i])) valid = false;
        }
        for (let i = start + intDigits + 1; i < withoutLast.length; i++) {
          if (!this.isDigitChar(withoutLast[i])) valid = false;
        }
        if (!valid) continue;

        const prefix = withoutLast.slice(0, start);
        const ht = this.parseMoneyValue(prefix);
        const tva = this.parseMoneyValue(withoutLast.slice(start));
        if (ht === null || tva === null || ht <= 0 || tva <= 0) continue;

        const ratio = tva / ht;
        const diff = Math.abs((ht + tva) - ttc);
        const tolerance = Math.max(1, ttc * 0.03);

        if (ratio < 0.05 || ratio > 0.35) continue;
        if (diff > tolerance) continue;

        return [ht, tva, ttc];
      }
    }

    return [];
  }

  extractTrailingMoneyPart(token) {
    if (!token) return null;

    for (let decimals = 4; decimals >= 2; decimals--) {
      for (let intDigits = 4; intDigits >= 1; intDigits--) {
        const length = intDigits + 1 + decimals;
        const start = token.length - length;
        if (start < 0) continue;

        const sep = token[start + intDigits];
        if (sep !== ',' && sep !== '.') continue;

        let valid = true;
        for (let i = start; i < start + intDigits; i++) {
          if (!this.isDigitChar(token[i])) valid = false;
        }
        for (let i = start + intDigits + 1; i < token.length; i++) {
          if (!this.isDigitChar(token[i])) valid = false;
        }
        if (!valid) continue;

        const raw = token.slice(start);
        const value = this.parseMoneyValue(raw);
        if (value === null) continue;

        return { start, value };
      }
    }

    return null;
  }

  readTrailingMoneyChunk(token, endExclusive) {
    if (endExclusive < 4) return null;

    const decimalSep = token[endExclusive - 3];
    if (decimalSep !== ',' && decimalSep !== '.') return null;
    if (!this.isDigitChar(token[endExclusive - 2]) || !this.isDigitChar(token[endExclusive - 1])) return null;

    let start = endExclusive - 3;
    while (start - 1 >= 0) {
      const prev = token[start - 1];
      if (this.isDigitChar(prev)) {
        start--;
        continue;
      }
      if ((prev === ',' || prev === '.') && start - 4 >= 0 &&
          this.isDigitChar(token[start - 2]) &&
          this.isDigitChar(token[start - 3]) &&
          this.isDigitChar(token[start - 4])) {
        start--;
        continue;
      }
      break;
    }

    const raw = token.slice(start, endExclusive);
    const parsed = this.parseMoneyValue(raw);
    if (parsed === null) return null;

    return { start, value: parsed };
  }

  isDigitChar(char) {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return code >= 48 && code <= 57;
  }

  containsFrenchNumberWords(text) {
    const tokens = this.tokenizeFrenchWords(text);
    for (let i = 0; i < tokens.length; i++) {
      if (this.isFrenchNumberWord(tokens[i])) {
        return true;
      }
    }
    return false;
  }

  parseFrenchAmountWords(text) {
    if (!text) return null;

    const tokens = this.tokenizeFrenchWords(text);
    if (tokens.length === 0) return null;

    let integerTokens = [];
    let centsTokens = [];
    let centsValue = 0;
    let sawNumberWord = false;
    let afterCurrencyMarker = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token === "dh" || token === "dhs" || token === "dirham" || token === "dirhams") {
        afterCurrencyMarker = true;
        continue;
      }

      if (!afterCurrencyMarker && this.isFrenchNumberWord(token)) {
        integerTokens.push(token);
        sawNumberWord = true;
        continue;
      }

      if (!afterCurrencyMarker && token === "et" && i + 2 < tokens.length) {
        const next = tokens[i + 1];
        const nextNext = tokens[i + 2];
        if (this.looksLikePureNumber(next) && this.isFrenchCentsToken(nextNext)) {
          centsValue = parseInt(next, 10);
        }
        continue;
      }

      if (afterCurrencyMarker) {
        if (this.isFrenchNumberWord(token)) {
          centsTokens.push(token);
          continue;
        }

        if (this.looksLikePureNumber(token) && i + 1 < tokens.length && this.isFrenchCentsToken(tokens[i + 1])) {
          centsValue = parseInt(token, 10);
          break;
        }

        if (this.isFrenchCentsToken(token)) {
          const parsedCents = this.parseFrenchIntegerWords(centsTokens);
          if (parsedCents !== null) {
            centsValue = parsedCents;
          }
          break;
        }
      }
    }

    if (!sawNumberWord) return null;

    const integerValue = this.parseFrenchIntegerWords(integerTokens);
    if (integerValue === null) return null;

    return Math.round((integerValue + (centsValue / 100)) * 100) / 100;
  }

  isFrenchCentsToken(token) {
    return token === "ct" ||
      token === "cts" ||
      token === "cte" ||
      token === "ctes" ||
      token === "centime" ||
      token === "centimes";
  }

  parseFrenchIntegerWords(tokens) {
    if (!tokens || tokens.length === 0) return null;

    let total = 0;
    let current = 0;
    let sawAny = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token === "et") continue;

      const nextToken = i + 1 < tokens.length ? tokens[i + 1] : "";
      if ((token === "quatre" || token === "quatrevingt") && this.isFrenchTwentyToken(nextToken)) {
        current += 80;
        sawAny = true;
        i += 1;
        continue;
      }

      if (this.frenchUnits.hasOwnProperty(token)) {
        current += this.frenchUnits[token];
        sawAny = true;
        continue;
      }

      if (this.frenchTens.hasOwnProperty(token)) {
        current += this.frenchTens[token];
        sawAny = true;
        continue;
      }

      if (token === "cent" || token === "cents") {
        if (current === 0) current = 1;
        current *= 100;
        sawAny = true;
        continue;
      }

      if (token === "mille") {
        if (current === 0) current = 1;
        total += current * 1000;
        current = 0;
        sawAny = true;
        continue;
      }

      if (token === "million" || token === "millions") {
        if (current === 0) current = 1;
        total += current * 1000000;
        current = 0;
        sawAny = true;
      }
    }

    if (!sawAny) return null;
    return total + current;
  }

  isFrenchNumberWord(token) {
    if (!token) return false;
    return this.frenchUnits.hasOwnProperty(token) ||
      this.frenchTens.hasOwnProperty(token) ||
      token === "cent" ||
      token === "cents" ||
      token === "vingts" ||
      token === "mille" ||
      token === "million" ||
      token === "millions" ||
      token === "et";
  }

  isFrenchTwentyToken(token) {
    return token === "vingt" || token === "vingts";
  }

  tokenizeFrenchWords(text) {
    const tokens = [];
    let current = "";
    const lower = this.toLowerCaseSafe(text);

    for (let i = 0; i < lower.length; i++) {
      let char = this.normalizeFrenchChar(lower[i]);
      const code = char.charCodeAt(0);
      const isLetter = (code >= 97 && code <= 122);
      const isDigit = code >= 48 && code <= 57;

      if (isLetter || isDigit) {
        current += char;
      } else {
        if (current.length > 0) {
          const expanded = this.expandCompactFrenchNumberToken(current);
          for (let j = 0; j < expanded.length; j++) {
            tokens.push(expanded[j]);
          }
          current = "";
        }
      }
    }

    if (current.length > 0) {
      const expanded = this.expandCompactFrenchNumberToken(current);
      for (let i = 0; i < expanded.length; i++) {
        tokens.push(expanded[i]);
      }
    }

    return tokens;
  }

  expandCompactFrenchNumberToken(token) {
    const normalized = this.normalizeFrenchWord(token || "");
    if (!normalized) return [];

    if (this.isFrenchNumberWord(normalized) ||
        this.isFrenchCentsToken(normalized) ||
        this.looksLikePureNumber(normalized)) {
      return [normalized];
    }

    const parts = this.trySplitCompactFrenchNumberToken(normalized);
    if (parts && parts.length > 1) {
      return parts;
    }

    return [normalized];
  }

  trySplitCompactFrenchNumberToken(token) {
    const knownParts = this.frenchCompactNumberParts || [];

    const walk = (remaining) => {
      if (!remaining) return [];

      for (let i = 0; i < knownParts.length; i++) {
        const part = knownParts[i];
        if (!this.containsSubstring(remaining, part) || remaining.indexOf(part) !== 0) {
          continue;
        }

        const tail = remaining.slice(part.length);
        if (!tail) {
          return [part];
        }

        const tailParts = walk(tail);
        if (tailParts) {
          return [part].concat(tailParts);
        }
      }

      return null;
    };

    return walk(token);
  }

  normalizeFrenchChar(char) {
    switch (char) {
      case "À":
      case "à":
      case "Â":
      case "â":
      case "Ä":
      case "ä":
        return "a";
      case "Ç":
      case "ç":
        return "c";
      case "È":
      case "É":
      case "Ê":
      case "Ë":
      case "è":
      case "é":
      case "ê":
      case "ë":
        return "e";
      case "Î":
      case "Ï":
      case "î":
      case "ï":
        return "i";
      case "Ô":
      case "Ö":
      case "ô":
      case "ö":
        return "o";
      case "Ù":
      case "Û":
      case "Ü":
      case "ù":
      case "û":
      case "ü":
        return "u";
      default:
        return char;
    }
  }

  // =========================================================================
  // STEP 5: CANDIDATE SCORING
  // =========================================================================

  /**
   * Score and rank candidates for each field
   */
  scoreCandidates(candidates, zones) {
    const scored = {};

    // Score invoice number candidates
    scored.numeroFacture = this.scoreInvoiceNumberCandidates(candidates.numeroFacture, zones);

    // Score supplier candidates
    scored.fournisseur = this.scoreSupplierCandidates(candidates.fournisseur, zones);

    // Score ice candidates
    scored.ice = this.scoreIceCandidates(candidates.ice, zones);

    // Score date candidates
    scored.dateFacture = this.scoreDateCandidates(candidates.dateFacture, zones);

    // Score money candidates (with triplet validation)
    scored.money = this.scoreMoneyCandidates(candidates);

    if (this.enableLearnedReranker) {
      this.applyLearnedReranker(scored);
    }

    return scored;
  }

  applyLearnedReranker(scored) {
    scored.numeroFacture = this.rerankCandidateList(scored.numeroFacture, "numeroFacture");
    scored.fournisseur = this.rerankCandidateList(scored.fournisseur, "fournisseur");
    scored.ice = this.rerankCandidateList(scored.ice, "ice");
    scored.dateFacture = this.rerankCandidateList(scored.dateFacture, "dateFacture");

    if (scored.money) {
      scored.money.ht = this.rerankCandidateList(scored.money.ht, "montantHt");
      scored.money.tva = this.rerankCandidateList(scored.money.tva, "tva");
      scored.money.ttc = this.rerankCandidateList(scored.money.ttc, "montantTtc");
      scored.money.triplets = this.rerankTripletList(scored.money.triplets);
    }
  }

  rerankCandidateList(candidates, fieldName) {
    const list = candidates || [];
    if (list.length === 0) return list;

    // Use neural reranker if available and enabled
    if (this.enableNeuralReranker && this.neuralReranker && this.neuralReranker.isAvailable()) {
      return this.rerankWithNeuralNetwork(list, fieldName);
    }

    // Fallback to pairwise ranking model
    return this.rerankWithPairwiseModel(list, fieldName);
  }

  rerankWithPairwiseModel(candidates, fieldName) {
    const list = candidates;
    const weights = this.learnedRerankerWeights[fieldName];
    if (!weights || list.length === 0) return list;

    const featureList = [];
    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      const heuristicScore = this.normalizeConfidence(candidate.score || 0);
      const features = this.buildRerankerFeatures(candidate, fieldName);
      featureList.push({
        candidate,
        heuristicScore,
        features
      });
    }

    for (let i = 0; i < featureList.length; i++) {
      const current = featureList[i];
      let winMass = 0;
      let comparisons = 0;

      for (let j = 0; j < featureList.length; j++) {
        if (i === j) continue;
        const opponent = featureList[j];
        const preference = this.computePairwisePreferenceProbability(current.features, opponent.features, weights);
        winMass += preference;
        comparisons++;
      }

      const mlProbability = comparisons > 0 ? (winMass / comparisons) : (current.heuristicScore / 100);
      const mlScore = this.normalizeConfidence(mlProbability * 100);
      const combinedScore = this.normalizeConfidence((current.heuristicScore * 0.55) + (mlScore * 0.45));

      current.candidate.heuristicScore = current.heuristicScore;
      current.candidate.mlFeatures = current.features;
      current.candidate.mlScore = mlScore;
      current.candidate.score = combinedScore;

      if (!current.candidate.reasons) current.candidate.reasons = [];
      current.candidate.reasons.push("reranked with learned pairwise model");

      // OVERRIDE: Very early candidates with high heuristic scores should not be dragged down by ML
      if ((current.candidate.lineIndex || 0) <= 2 && current.heuristicScore >= 90 && combinedScore < 80) {
        current.candidate.score = Math.max(combinedScore, 80);
      }
    }

    list.sort((a, b) => b.score - a.score);
    return list;
  }

  rerankWithNeuralNetwork(candidates, fieldName) {
    const list = candidates;
    if (list.length === 0) return list;

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      const heuristicScore = this.normalizeConfidence(candidate.score || 0);
      const features = this.buildRerankerFeatures(candidate, fieldName);

      // Get prediction from neural network
      const nnFeatures = this.buildNeuralFeatures(candidate, fieldName);
      const mlProbability = this.neuralReranker.predict(fieldName, nnFeatures);
      const mlScore = this.normalizeConfidence(mlProbability * 100);

      // Neural network gets higher weight (60%) than heuristics (40%)
      const combinedScore = this.normalizeConfidence((heuristicScore * 0.4) + (mlScore * 0.6));

      candidate.heuristicScore = heuristicScore;
      candidate.mlFeatures = { ...nnFeatures, ...this.buildRerankerFeatures(candidate, fieldName) };
      candidate.mlScore = mlScore;
      candidate.score = combinedScore;

      if (!candidate.reasons) candidate.reasons = [];
      candidate.reasons.push("reranked with neural network");
    }

    list.sort((a, b) => b.score - a.score);
    return list;
  }

  buildNeuralFeatures(candidate, fieldName) {
    const context = this.toLowerCaseSafe(candidate && candidate.context ? candidate.context : "");
    const value = candidate ? String(candidate.value || "") : "";
    const lineIndex = candidate && typeof candidate.lineIndex === "number" ? candidate.lineIndex : 999;

    return {
      // Base features
      heuristicScore: this.normalizeConfidence(candidate && candidate.score ? candidate.score : 0) / 100,
      zoneHeader: candidate && candidate.zone === "header" ? 1 : 0,
      zoneBody: candidate && candidate.zone === "body" ? 1 : 0,
      zoneFooter: candidate && candidate.zone === "footer" ? 1 : 0,
      hasInvoiceKeyword: this.containsAnyKeyword(context, this.invoiceKeywords) ? 1 : 0,
      hasSupplierKeyword: this.textHasSupplierKeyword(value) ? 1 : 0,
      hasSupplierAnchor: this.textHasSupplierAnchor(value) ? 1 : 0,
      hasPhone: this.containsPhonePattern(value) ? 1 : 0,
      hasAdminKeyword: this.containsAnyKeyword(context, this.excludeKeywords) ? 1 : 0,
      hasClientKeyword: this.containsSubstring(context, "client") ? 1 : 0,
      hasDateKeyword: this.containsAnyKeyword(context, this.dateKeywords) ? 1 : 0,
      hasTypeKeyword: this.hasFieldTypeKeyword(context, fieldName) ? 1 : 0,
      hasTotalKeyword: this.containsSubstring(context, "total") ? 1 : 0,
      payableKeyword: this.hasFinalPayableTotalContext(context) ? 1 : 0,
      looksLikeReference: this.looksLikeReference(value) ? 1 : 0,
      hasDigits: this.countDigits(value) > 0 ? 1 : 0,
      charLengthGood: value.length >= 6 && value.length <= 60 ? 1 : 0,
      goodLength: value.length >= 10 && value.length <= 60 ? 1 : 0,
      linePositionTop: 1 - Math.min(1, lineIndex / 20),
      validDate: candidate && candidate.parsed && candidate.parsed.valid ? 1 : 0,
      badDateContext: this.containsSubstring(context, "echeance") || this.containsSubstring(context, "limite") ? 1 : 0,
      explicitType: candidate && candidate.hasExplicitType ? 1 : 0,
      reasonableAmount: candidate && typeof candidate.value === "number" && candidate.value >= 50 && candidate.value <= 100000 ? 1 : 0,
      decimalAmount: candidate && typeof candidate.value === "number" && !Number.isInteger(candidate.value) ? 1 : 0,
      likelyRate: candidate && typeof candidate.value === "number" && candidate.value <= 30 ? 1 : 0,
      // Context features (will be filled from lastContext if available)
      qualityScore: 0.5,
      hasTriplet: 0,
      hasStructuredTotals: 0,
      // Document type features
      docType_electricity: 0,
      docType_telecom: 0,
      docType_water: 0
    };
  }

  rerankTripletList(triplets) {
    const list = triplets || [];
    const weights = this.learnedRerankerWeights.triplet;
    if (!weights || list.length === 0) return list;

    const featureList = [];
    for (let i = 0; i < list.length; i++) {
      const triplet = list[i];
      const heuristicScore = this.normalizeConfidence(triplet.score || 0);
      const features = this.buildTripletRerankerFeatures(triplet);
      featureList.push({
        triplet,
        heuristicScore,
        features
      });
    }

    for (let i = 0; i < featureList.length; i++) {
      const current = featureList[i];
      let winMass = 0;
      let comparisons = 0;

      for (let j = 0; j < featureList.length; j++) {
        if (i === j) continue;
        const opponent = featureList[j];
        const preference = this.computePairwisePreferenceProbability(current.features, opponent.features, weights);
        winMass += preference;
        comparisons++;
      }

      const mlProbability = comparisons > 0 ? (winMass / comparisons) : (current.heuristicScore / 100);
      const mlScore = this.normalizeConfidence(mlProbability * 100);
      const combinedScore = this.normalizeConfidence((current.heuristicScore * 0.6) + (mlScore * 0.4));

      current.triplet.heuristicScore = current.heuristicScore;
      current.triplet.mlFeatures = current.features;
      current.triplet.mlScore = mlScore;
      current.triplet.score = combinedScore;
      if (!current.triplet.reasons) current.triplet.reasons = [];
      current.triplet.reasons.push("reranked with learned pairwise model");
    }

    list.sort((a, b) => b.score - a.score);
    return list;
  }

  hasFinalPayableTotalContext(text) {
    const lower = this.toLowerCaseSafe(text || "");
    return this.containsAnyKeyword(lower, this.payableTotalKeywords || []);
  }

  buildRerankerFeatures(candidate, fieldName) {
    const context = this.toLowerCaseSafe(candidate && candidate.context ? candidate.context : "");
    const value = candidate ? String(candidate.value || "") : "";
    const normalizedHeuristic = this.normalizeConfidence(candidate && candidate.score ? candidate.score : 0) / 100;
    const lineIndex = candidate && typeof candidate.lineIndex === "number" ? candidate.lineIndex : 999;
    const linePositionTop = this.clamp01(1 - Math.min(1, lineIndex / 20));
    const hasAdminKeyword = this.containsAnyKeyword(context, this.excludeKeywords) ? 1 : 0;
    const hasDateKeyword = this.containsAnyKeyword(context, this.dateKeywords) ? 1 : 0;
    const hasTotalKeyword = this.containsSubstring(context, "total") ? 1 : 0;
    const payableKeyword = this.hasFinalPayableTotalContext(context) ? 1 : 0;
    const lineItemContext =
      this.containsSubstring(context, "tranche") ||
      this.containsSubstring(context, "quantite") ||
      this.containsSubstring(context, "quantitÃƒÂ©") ||
      this.containsSubstring(context, "prix unitaire") ? 1 : 0;

    return {
      heuristicScore: normalizedHeuristic,
      zoneHeader: candidate && candidate.zone === "header" ? 1 : 0,
      zoneBody: candidate && candidate.zone === "body" ? 1 : 0,
      zoneFooter: candidate && candidate.zone === "footer" ? 1 : 0,
      hasInvoiceKeyword: this.containsAnyKeyword(context, this.invoiceKeywords) ? 1 : 0,
      hasDateKeyword: hasDateKeyword,
      hasTypeKeyword: this.hasFieldTypeKeyword(context, fieldName) ? 1 : 0,
      hasTotalKeyword: hasTotalKeyword,
      payableKeyword: payableKeyword,
      supplierKeyword: this.textHasSupplierKeyword(value) ? 1 : 0,
      supplierAnchor: this.textHasSupplierAnchor(value) ? 1 : 0,
      hasPhone: this.containsPhonePattern(value) ? 1 : 0,
      hasAdminKeyword: hasAdminKeyword,
      hasClientKeyword:
        this.containsSubstring(context, "client") ||
        this.containsSubstring(context, "code client") ||
        this.containsSubstring(context, "contrat") ? 1 : 0,
      looksLikeReference: this.looksLikeReference(value) ? 1 : 0,
      hasDigits: this.countDigits(value) > 0 ? 1 : 0,
      charLengthGood: value.length >= 6 && value.length <= 60 ? 1 : 0,
      goodLength: value.length >= 10 && value.length <= 60 ? 1 : 0,
      linePositionTop: linePositionTop,
      validDate: candidate && candidate.parsed && candidate.parsed.valid ? 1 : 0,
      badDateContext:
        this.containsSubstring(context, "echeance") ||
        this.containsSubstring(context, "limite") ||
        this.containsSubstring(context, "du au") ||
        this.containsSubstring(context, "periode") ? 1 : 0,
      explicitType: candidate && candidate.hasExplicitType ? 1 : 0,
      reasonableAmount: candidate && typeof candidate.value === "number" && candidate.value >= 50 && candidate.value <= 100000 ? 1 : 0,
      decimalAmount: candidate && typeof candidate.value === "number" && !Number.isInteger(candidate.value) ? 1 : 0,
      likelyRate: candidate && typeof candidate.value === "number" && candidate.value <= 30 && Number.isInteger(candidate.value) ? 1 : 0,
      lineItemContext: lineItemContext
    };
  }

  buildTripletRerankerFeatures(triplet) {
    const ttcContext = this.toLowerCaseSafe(triplet && triplet.ttc && triplet.ttc.context ? triplet.ttc.context : "");
    const maxLineDiff = Math.max(
      Math.abs((triplet.ht ? triplet.ht.lineIndex : 0) - (triplet.tva ? triplet.tva.lineIndex : 0)),
      Math.abs((triplet.ht ? triplet.ht.lineIndex : 0) - (triplet.ttc ? triplet.ttc.lineIndex : 0)),
      Math.abs((triplet.tva ? triplet.tva.lineIndex : 0) - (triplet.ttc ? triplet.ttc.lineIndex : 0))
    );

    return {
      heuristicScore: this.normalizeConfidence(triplet && triplet.score ? triplet.score : 0) / 100,
      consistency: this.clamp01((triplet && triplet.consistency ? triplet.consistency : 0) / 100),
      compactness: this.clamp01(1 - (maxLineDiff / 10)),
      explicitTypes:
        triplet && triplet.ht && triplet.tva && triplet.ttc &&
        triplet.ht.hasExplicitType && triplet.tva.hasExplicitType && triplet.ttc.hasExplicitType ? 1 : 0,
      payableContext:
        this.containsSubstring(ttcContext, "montant a payer") ||
        this.containsSubstring(ttcContext, "montant ÃƒÂ  payer") ||
        this.containsSubstring(ttcContext, "net a payer") ||
        this.containsSubstring(ttcContext, "net ÃƒÂ  payer") ||
        this.containsSubstring(ttcContext, "total general") ||
        this.containsSubstring(ttcContext, "total gÃƒÂ©nÃƒÂ©ral") ? 1 : 0,
      lineItemPenalty:
        triplet && triplet.ht && triplet.ht.context &&
        (this.containsSubstring(this.toLowerCaseSafe(triplet.ht.context), "tranche") ||
         this.containsSubstring(this.toLowerCaseSafe(triplet.ht.context), "quantite") ||
         this.containsSubstring(this.toLowerCaseSafe(triplet.ht.context), "quantitÃƒÂ©")) ? 1 : 0
    };
  }

  hasFieldTypeKeyword(context, fieldName) {
    if (!context) return false;
    if (fieldName === "ice") return this.containsSubstring(context, "ice");
    if (fieldName === "montantHt") return this.containsAnyKeyword(context, this.moneyKeywords.ht);
    if (fieldName === "tva") return this.containsAnyKeyword(context, this.moneyKeywords.tva);
    if (fieldName === "montantTtc") return this.containsAnyKeyword(context, this.moneyKeywords.ttc);
    return false;
  }

  computeLinearModelProbability(features, weights) {
    let total = weights && typeof weights.bias === "number" ? weights.bias : 0;
    const keys = Object.keys(features || {});

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof weights[key] === "number") {
        total += features[key] * weights[key];
      }
    }

    return this.sigmoid(total);
  }

  computePairwisePreferenceProbability(leftFeatures, rightFeatures, weights) {
    let total = weights && typeof weights.bias === "number" ? weights.bias : 0;
    const features = leftFeatures || {};
    const other = rightFeatures || {};

    for (const key in features) {
      if (key === "bias") continue;
      if (typeof weights[key] === "number") {
        const leftValue = typeof features[key] === "number" ? features[key] : 0;
        const rightValue = typeof other[key] === "number" ? other[key] : 0;
        total += (leftValue - rightValue) * weights[key];
      }
    }

    for (const key in other) {
      if (key === "bias") continue;
      if (typeof features[key] === "number") continue;
      if (typeof weights[key] === "number") {
        const rightValue = typeof other[key] === "number" ? other[key] : 0;
        total += (0 - rightValue) * weights[key];
      }
    }

    return this.sigmoid(total);
  }

  sigmoid(value) {
    if (value >= 0) {
      const z = Math.exp(-value);
      return 1 / (1 + z);
    }

    const z = Math.exp(value);
    return z / (1 + z);
  }

  clamp01(value) {
    if (typeof value !== "number" || isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  scoreInvoiceNumberCandidates(candidates, zones) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let score = 50; // Base score
      const lowerContext = this.toLowerCaseSafe(candidate.context);

      // Bonus for being in header zone
      if (candidate.zone === "header") {
        score += 20;
        candidate.reasons.push("found in header zone");
      }

      // Bonus for having invoice keyword nearby
      if (lowerContext.indexOf("facture") !== -1) {
        score += 25;
        candidate.reasons.push("near 'facture' keyword");
      }

      if (this.containsSubstring(lowerContext, "client") ||
          this.containsSubstring(lowerContext, "code client") ||
          this.containsSubstring(lowerContext, "contrat")) {
        score -= 50;
        candidate.reasons.push("client/contract context");
      }

      // Bonus for reference-like format
      if (this.looksLikeReference(candidate.value)) {
        score += 15;
        candidate.reasons.push("valid reference format");
      } else if (this.looksLikePureNumber(candidate.value) &&
                 candidate.value.length >= 6 &&
                 (this.containsSubstring(lowerContext, "facture") ||
                  this.containsSubstring(lowerContext, "numero") ||
                  this.containsSubstring(lowerContext, "n :") ||
                  this.containsSubstring(lowerContext, "n:"))) {
        score += 15;
        candidate.reasons.push("pure numeric reference with invoice marker");
      }

      if (!this.isLikelyInvoiceReference(candidate.value, candidate.context)) {
        const gridMapped = candidate.reasons && candidate.reasons.indexOf("mapped from facture/date grid") !== -1;
        if (!gridMapped || !this.looksLikePureNumber(candidate.value) || candidate.value.length < 4 || candidate.value.length > 8) {
          score -= 60;
          candidate.reasons.push("weak invoice reference");
        }
      }

      if (this.looksLikeDate(candidate.value || "")) {
        score -= 55;
        candidate.reasons.push("date-like reference candidate");
      }

      if (candidate.reasons && candidate.reasons.indexOf("found on compact invoice marker line") !== -1) {
        score += 30;
        candidate.reasons.push("compact invoice marker line");
      }

      if (candidate.reasons && candidate.reasons.indexOf("mapped from facture/date grid") !== -1) {
        score += 40;
        candidate.reasons.push("facture header grid reference");
      }

      let digitCount = 0;
      for (let j = 0; j < candidate.value.length; j++) {
        const code = candidate.value.charCodeAt(j);
        if (code >= 48 && code <= 57) digitCount++;
      }
      if (digitCount < 2) {
        score -= 35;
      }

      // Penalty for being too short
      if (candidate.value.length < 3) {
        score -= 20;
      }

      const memoryBoost = this.computeInvoiceMemoryBoost(candidate);
      if (memoryBoost > 0) {
        score += memoryBoost;
        candidate.reasons.push("matches historical invoice prefix");
      }

      candidate.score = Math.max(0, Math.min(100, score));
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
  }

  scoreSupplierCandidates(candidates, zones) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      candidate.value = this.trimSupplierTail(candidate.value);
      let score = candidate.score || 50;
      const reasonText = Array.isArray(candidate.reasons) ? candidate.reasons.join(" ").toLowerCase() : "";

      // Bonus for being in header
      if (candidate.zone === "header") {
        score += 15;
        candidate.reasons.push("found in header zone");
        const topBias = Math.max(0, 18 - ((candidate.lineIndex || 0) * 3));
        if (topBias > 0) {
          score += topBias;
          candidate.reasons.push("top-of-header supplier bias");
        }
      }

      // Bonus for containing supplier keywords
      const lowerValue = candidate.value.toLowerCase();
      if (this.textHasSupplierKeyword(candidate.value)) {
        score += 20;
        candidate.reasons.push("contains supplier keyword");
      }

      if (this.textHasSupplierAnchor(candidate.value)) {
        score += 20;
        candidate.reasons.push("contains supplier anchor");
        if (candidate.zone !== "header") {
          score += 10;
          candidate.reasons.push("supplier anchor outside header");
        }
      }

      // Bonus for good length (company names are typically 10-60 chars)
      if (candidate.value.length >= 10 && candidate.value.length <= 60) {
        score += 15;
        candidate.reasons.push("appropriate length for company name");
      } else if (candidate.value.length > 60 && candidate.value.length <= 120) {
        score += 5;
        candidate.reasons.push("extended multi-line company block");
      }

      if (candidate.zone === "header" &&
          candidate.lineIndex <= 3 &&
          this.tokenize(candidate.value).length === 1 &&
          candidate.value === candidate.value.toUpperCase() &&
          this.countLetters(candidate.value) >= 5 &&
          this.countDigits(candidate.value) === 0) {
        score += 30;
        candidate.reasons.push("early compact header brand");
      }

      // Bonus for short brand names at the very top (e.g., "1PORT", "3M")
      if (candidate.zone === "header" &&
          (candidate.lineIndex || 0) <= 1 &&
          this.tokenize(candidate.value).length === 1 &&
          candidate.value.length >= 3 &&
          candidate.value.length <= 8 &&
          this.countLetters(candidate.value) >= 2) {
        score += 25;
        candidate.reasons.push("top-line brand name");
      }

      if (reasonText.indexOf("noisy agent ebertec supplier") !== -1 ||
          reasonText.indexOf("noisy agent goods-goods brand") !== -1 ||
          reasonText.indexOf("noisy agent ace-maree supplier") !== -1 ||
          reasonText.indexOf("noisy agent assurances-almassar supplier") !== -1) {
        score += 35;
        candidate.reasons.push("provider-branded supplier");
      }

      if (candidate.zone === "header" &&
          candidate.lineIndex >= 8 &&
          this.tokenize(candidate.value).length === 1 &&
          candidate.value === candidate.value.toUpperCase() &&
          this.countLetters(candidate.value) >= 5 &&
          !this.textHasSupplierAnchor(candidate.value)) {
        score -= 20;
        candidate.reasons.push("late header contact/person candidate");
      }

      if (candidate.zone === "header" &&
          candidate.lineIndex > 4 &&
          this.tokenize(candidate.value).length === 1 &&
          candidate.value === candidate.value.toUpperCase() &&
          this.countLetters(candidate.value) >= 8 &&
          !this.textHasSupplierAnchor(candidate.value)) {
        score -= 35;
        candidate.reasons.push("likely customer/contact line");
      }

      // Penalty for containing phone-like patterns
      if (this.containsPhonePattern(candidate.value)) {
        score -= 30;
      }

      // Penalty for containing admin keywords
      if (this.textHasExactKeyword(candidate.value, this.excludeKeywords)) {
        score -= 25;
      }

      if (this.textHasExactKeyword(candidate.value, this.supplierNoiseKeywords)) {
        score -= 120;
        candidate.reasons.push("generic service/category text");
      }

      if (this.containsSubstring(lowerValue, "client") ||
          this.containsSubstring(lowerValue, "vehicule") ||
          this.containsSubstring(lowerValue, "vehicle") ||
          this.containsSubstring(lowerValue, "pearl morocco travel") ||
          this.containsSubstring(lowerValue, "pearl")) {
        score -= 40;
        candidate.reasons.push("customer/vehicle text");
      }

      if (this.containsSubstring(lowerValue, "emetteur") ||
          this.containsSubstring(lowerValue, "Ã©metteur") ||
          this.containsSubstring(lowerValue, "adress") ||
          this.containsSubstring(lowerValue, "adres")) {
        score -= 80;
        candidate.reasons.push("meta label text");
      }

      if (this.looksLikeSupplierGarbage(candidate.value)) {
        score -= 90;
        candidate.reasons.push("ocr-garbage supplier text");
      }

      if (this.looksLikeAddressFragment(candidate.value) &&
          !this.textHasSupplierKeyword(candidate.value) &&
          !this.textHasSupplierAnchor(candidate.value)) {
        score -= 55;
        candidate.reasons.push("address-like candidate");
      }

      if (candidate.zone === "header" &&
          (candidate.lineIndex || 0) <= 8 &&
          this.tokenize(candidate.value).length === 1 &&
          candidate.value === candidate.value.toUpperCase() &&
          this.countLetters(candidate.value) >= 5 &&
          this.countDigits(candidate.value) === 0) {
        score += 28;
        candidate.reasons.push("compact branded header line");
      }

      if (lowerValue === "numero" || lowerValue === "num" || lowerValue === "number") {
        score -= 140;
        candidate.reasons.push("generic label text");
      }

      // NEW: Additional penalties for confidence calibration
      // Penalty for very short names (likely truncated or wrong)
      if (candidate.value.length < 6) {
        // Reduced penalty for very early document positions (short brand names like "1PORT", "3M")
        const shortPenalty = (candidate.lineIndex || 0) <= 2 ? 10 : 35;
        score -= shortPenalty;
        candidate.reasons.push("supplier name too short");
      }

      // Penalty for containing parentheses with garbage
      if (this.containsSubstring(candidate.value, "(") && 
          this.containsSubstring(candidate.value, ")")) {
        const parenContent = candidate.value.match(/\(([^)]*)\)/);
        if (parenContent && parenContent[1].length > 3) {
          const content = parenContent[1].toLowerCase();
          if (!this.textHasSupplierKeyword(content) && !this.textHasSupplierAnchor(content)) {
            score -= 25;
            candidate.reasons.push("suspicious parenthetical content");
          }
        }
      }

      // Penalty for containing ampersand or pipe (OCR artifacts)
      if (this.containsSubstring(candidate.value, "&") ||
          this.containsSubstring(candidate.value, "|")) {
        score -= 30;
        candidate.reasons.push("contains OCR artifact characters");
      }

      // Penalty for containing "scann" or "camscanner"
      if (this.containsSubstring(lowerValue, "scann") ||
          this.containsSubstring(lowerValue, "camscanner")) {
        score -= 100;
        candidate.reasons.push("scanner watermark detected");
      }

      // Penalty for containing email-like patterns
      if (this.containsEmailPattern(candidate.value)) {
        score -= 40;
        candidate.reasons.push("contains email pattern");
      }

      // Bonus for having clean, strong supplier pattern
      if (this.textHasStrongSupplierAnchor(candidate.value) && 
          candidate.value.length >= 10 && 
          candidate.value.length <= 50) {
        score += 10;
        candidate.reasons.push("clean strong supplier pattern");
      }

      const memoryBoost = this.computeSupplierMemoryBoost(candidate);
      if (memoryBoost > 0) {
        score += memoryBoost;
        candidate.reasons.push("matches historical supplier memory");
      }

      candidate.score = Math.max(0, Math.min(100, score));
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
  }

  scoreIceCandidates(candidates, zones) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let score = 50;
      const lowerContext = this.toLowerCaseSafe(candidate.context || "");

      if (candidate.zone === "header") {
        score += 15;
        candidate.reasons.push("found in header zone");
      } else if (candidate.zone === "body") {
        score += 5;
      }

      if (this.containsSubstring(lowerContext, "ice")) {
        score += 30;
        candidate.reasons.push("near ice keyword");
      }

      if (this.containsAnyKeyword(lowerContext, this.excludeKeywords)) {
        score += 10;
        candidate.reasons.push("admin context");
      }

      if (candidate.value && candidate.value.length === 15) {
        score += 20;
        candidate.reasons.push("standard 15-digit ice length");
      } else if (candidate.value && candidate.value.length >= 12 && candidate.value.length <= 20) {
        score += 10;
        candidate.reasons.push("plausible ice length");
      } else {
        score -= 40;
        candidate.reasons.push("unlikely ice length");
      }

      if (!this.looksLikePureNumber(candidate.value || "")) {
        score -= 60;
        candidate.reasons.push("ice should be numeric");
      }

      const memoryBoost = this.computeIceMemoryBoost(candidate);
      if (memoryBoost > 0) {
        score += memoryBoost;
        candidate.reasons.push("matches historical ICE memory");
      }

      candidate.score = Math.max(0, Math.min(100, score));
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  scoreDateCandidates(candidates, zones) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let score = 50; // Base score

      // Bonus for valid date parsing
      if (candidate.parsed && candidate.parsed.valid) {
        score += 30;
        candidate.reasons.push("valid date format");

        // Bonus for reasonable year (not too old, not future)
        const year = candidate.parsed.year;
        if (year >= 2020 && year <= 2030) {
          score += 15;
          candidate.reasons.push("reasonable year");
        }
      } else {
        score -= 80;
        candidate.reasons.push("invalid date");
      }

      // Bonus for being near date keywords
      const lowerContext = candidate.context.toLowerCase();
      for (let j = 0; j < this.dateKeywords.length; j++) {
        if (this.containsSubstring(lowerContext, this.dateKeywords[j])) {
          score += 15;
          candidate.reasons.push("near date keyword");
          break;
        }
      }

      if (candidate.reasons &&
          (candidate.reasons.indexOf("found on line after date label") !== -1 ||
           candidate.reasons.indexOf("found on line after invoice-date label") !== -1 ||
           candidate.reasons.indexOf("mapped from single stacked header label") !== -1)) {
        score += 25;
        candidate.reasons.push("explicit invoice-date label");
      }

      // Penalty for being in product/body zone (might be delivery date)
      if (candidate.zone === "body") {
        score -= 15;
      }

      if (this.containsSubstring(lowerContext, "echeance") ||
          this.containsSubstring(lowerContext, "dateecheance") ||
          this.containsSubstring(lowerContext, "limite") ||
          this.containsSubstring(lowerContext, "du au") ||
          this.containsSubstring(lowerContext, "periode")) {
        score -= 30;
        candidate.reasons.push("non-invoice date context");
      }

      if (candidate.reasons && candidate.reasons.indexOf("mapped from facture/date grid") !== -1) {
        score += 30;
        candidate.reasons.push("facture header grid date");
      }

      const memoryBoost = this.computeDateMemoryBoost(candidate);
      if (memoryBoost > 0) {
        score += memoryBoost;
        candidate.reasons.push("matches historical date format");
      }

      candidate.score = Math.max(0, Math.min(100, score));
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
  }

  scoreMoneyCandidates(candidates) {
    const result = {
      ht: [],
      tva: [],
      ttc: [],
      triplets: []
    };

    // Score individual candidates - handle both naming conventions
    const htList = candidates.ht || candidates.montantHt || [];
    const tvaList = candidates.tva || [];
    const ttcList = candidates.ttc || candidates.montantTtc || [];

    // Score individual candidates
    const scoreMoneyList = (list, type) => {
      if (!list || list.length === 0) return;

      for (let i = 0; i < list.length; i++) {
        const candidate = list[i];
        let score = 50;
        const lowerContext = candidate.context.toLowerCase();
        const reasonText = Array.isArray(candidate.reasons) ? candidate.reasons.join(" ").toLowerCase() : "";

        // Bonus for being in footer/totals zone
        if (candidate.zone === "footer") {
          score += 20;
          candidate.reasons.push("found in totals zone");
        }

        // Bonus for having type keyword
        if (this.containsAnyKeyword(lowerContext, this.moneyKeywords[type])) {
          score += 30;
          candidate.reasons.push("has " + type + " keyword");
        }

        if (type === "ttc" && candidate.reasons && candidate.reasons.indexOf("written total amount") !== -1) {
          score += 35;
          candidate.reasons.push("written total candidate");
        }

        if (type === "ttc" &&
            reasonText.indexOf("noisy agent") !== -1 &&
            reasonText.indexOf("explicit total") !== -1) {
          score += 40;
          candidate.reasons.push("provider explicit total");
        }

        // Bonus for reasonable amount
        if (candidate.value >= 100 && candidate.value <= 100000) {
          score += 15;
          candidate.reasons.push("reasonable amount");
        } else if (candidate.value < 10) {
          score -= 45;
          candidate.reasons.push("suspiciously tiny amount");
        } else if (candidate.value < 50 && type !== "tva") {
          score -= 25;
          candidate.reasons.push("too small for invoice total");
        }

        // Penalty for phone-like numbers
        if (this.phoneCodes.indexOf(Math.floor(candidate.value)) !== -1) {
          score -= 40;
        }

        if (this.containsSubstring(lowerContext, "client") ||
            this.containsSubstring(lowerContext, "ice") ||
            this.containsSubstring(lowerContext, "rc") ||
            this.containsSubstring(lowerContext, "contrat")) {
          score -= 35;
          candidate.reasons.push("admin/client context");
        }

        // TVA-specific scoring: prefer actual amounts over rates
        if (type === "tva") {
          // Penalty for small integers (likely tax rates like 20%, 10%, etc.)
          if (candidate.value <= 30 && Number.isInteger(candidate.value)) {
            score -= 50;
            candidate.reasons.push("likely a tax rate, not amount");
          }
          
          // Bonus for values with decimals (more likely to be actual amounts)
          if (!Number.isInteger(candidate.value)) {
            score += 20;
            candidate.reasons.push("has decimal value (likely amount)");
          }
          
          // Bonus for TVA amounts that are reasonable relative to typical HT
          // TVA is typically 7-25% of HT, so if value is between 50 and 5000, it's plausible
          if (candidate.value >= 50 && candidate.value <= 5000) {
            score += 10;
            candidate.reasons.push("plausible TVA amount");
          }
        } else {
          if (candidate.hasExplicitType) {
            score += 10;
            candidate.reasons.push("explicit totals label");
          }
        }

        if (type === "ttc" && this.containsSubstring(lowerContext, "total")) {
          score += 10;
          candidate.reasons.push("total context");
        }

        if (type === "ttc" &&
            (this.containsSubstring(lowerContext, "montant a payer") ||
             this.containsSubstring(lowerContext, "montant Ã  payer") ||
             this.containsSubstring(lowerContext, "net a payer") ||
             this.containsSubstring(lowerContext, "net Ã  payer") ||
             this.containsSubstring(lowerContext, "total general") ||
             this.containsSubstring(lowerContext, "total gÃ©nÃ©ral"))) {
          score += 35;
          candidate.reasons.push("payable/final total context");
	        }

	        if (type === "ttc" &&
	            this.hasFinalPayableTotalContext(lowerContext) &&
	            candidate.reasons.indexOf("payable/final total context") === -1) {
	          score += 35;
	          candidate.reasons.push("payable/final total context");
	        }

	        if ((type === "ht" || type === "ttc") &&
	            (this.containsSubstring(lowerContext, "tranche") ||
	             this.containsSubstring(lowerContext, "quantite") ||
             this.containsSubstring(lowerContext, "quantitÃ©") ||
             this.containsSubstring(lowerContext, "prix unitaire"))) {
          score -= 25;
          candidate.reasons.push("line-item context");
        }

        candidate.score = Math.max(0, Math.min(100, score));
      }

      list.sort((a, b) => b.score - a.score);
    };

    scoreMoneyList(htList, "ht");
    scoreMoneyList(tvaList, "tva");
    scoreMoneyList(ttcList, "ttc");

    result.ht = htList;
    result.tva = tvaList;
    result.ttc = ttcList;

    // Find best triplets (HT + TVA ≈ TTC)
    result.triplets = this.findMoneyTriplets(htList, tvaList, ttcList);

    return result;
  }

  findMoneyTriplets(htCandidates, tvaCandidates, ttcCandidates) {
    const triplets = [];

    // Handle undefined arrays
    if (!htCandidates) htCandidates = [];
    if (!tvaCandidates) tvaCandidates = [];
    if (!ttcCandidates) ttcCandidates = [];

    for (let i = 0; i < htCandidates.length; i++) {
      for (let j = 0; j < tvaCandidates.length; j++) {
        for (let k = 0; k < ttcCandidates.length; k++) {
          const ht = htCandidates[i];
          const tva = tvaCandidates[j];
          const ttc = ttcCandidates[k];

          // Check if HT + TVA ≈ TTC (within 5% tolerance)
          const expected = ht.value + tva.value;
          const diff = Math.abs(expected - ttc.value);
          const tolerance = Math.max(1, ttc.value * 0.05);

          if (diff <= tolerance) {
            if (!this.isPlausibleMoneyCombination(ht.value, tva.value, ttc.value)) {
              continue;
            }

            const triplet = {
              ht: ht,
              tva: tva,
              ttc: ttc,
              score: (ht.score + tva.score + ttc.score) / 3,
              mathDiff: diff,
              consistency: 100 - (diff / ttc.value * 100),
              reasons: ["HT + TVA ≈ TTC", "mathematically consistent"]
            };

            // Bonus for being on same or nearby lines
            const maxLineDiff = Math.max(
              Math.abs(ht.lineIndex - tva.lineIndex),
              Math.abs(ht.lineIndex - ttc.lineIndex),
              Math.abs(tva.lineIndex - ttc.lineIndex)
            );

            if (maxLineDiff <= 1) {
              triplet.score += 20;
              triplet.reasons.push("values on same or adjacent lines");
            }

            if (ht.hasExplicitType && tva.hasExplicitType && ttc.hasExplicitType) {
              triplet.score += 20;
              triplet.reasons.push("all values explicitly typed");
            }

            const ttcContext = this.toLowerCaseSafe(ttc.context || "");
            const htContext = this.toLowerCaseSafe(ht.context || "");
            if (this.containsSubstring(ttcContext, "montant a payer") ||
                this.containsSubstring(ttcContext, "montant Ã  payer") ||
                this.containsSubstring(ttcContext, "net a payer") ||
                this.containsSubstring(ttcContext, "net Ã  payer") ||
                this.containsSubstring(ttcContext, "total general") ||
                this.containsSubstring(ttcContext, "total gÃ©nÃ©ral")) {
              triplet.score += 30;
              triplet.reasons.push("final payable total");
            }

            if (this.hasFinalPayableTotalContext(ttcContext) &&
                triplet.reasons.indexOf("final payable total") === -1) {
              triplet.score += 30;
              triplet.reasons.push("final payable total");
            }

            if (this.containsSubstring(htContext, "tranche") ||
                this.containsSubstring(htContext, "quantite") ||
                this.containsSubstring(htContext, "quantitÃ©")) {
              triplet.score -= 25;
              triplet.reasons.push("line-item triplet");
            }

            triplets.push(triplet);
          }
        }
      }
    }

    // Prefer the most mathematically exact triplet first.
    // This prevents a nearby payable amount like 76.38 from beating
    // an exact totals-row TTC like 76.19 when HT + TVA matches exactly.
    triplets.sort((a, b) => {
      const diffGap = (a.mathDiff || 0) - (b.mathDiff || 0);
      if (Math.abs(diffGap) > 0.01) return diffGap;

      const consistencyGap = (b.consistency || 0) - (a.consistency || 0);
      if (Math.abs(consistencyGap) > 0.01) return consistencyGap;

      return (b.score || 0) - (a.score || 0);
    });

    return triplets;
  }

  selectStandaloneTtcCandidate(candidates) {
    const list = candidates || [];
    let best = null;
    let bestScore = -1;
    let bestWritten = null;
    let bestExplicitTotal = null;

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate) continue;

      let score = typeof candidate.score === "number" ? candidate.score : 0;
      const context = this.toLowerCaseSafe(candidate.context || "");
      const reasons = candidate.reasons || [];
      const reasonText = Array.isArray(reasons) ? reasons.join(" ").toLowerCase() : "";
      const isWritten = reasons.indexOf("written total amount") !== -1;
      const isExplicitTotal =
        !!candidate.hasExplicitType &&
        (this.containsAnyKeyword(context, this.moneyKeywords.ttc || []) ||
         this.containsSubstring(context, "total"));

      if (this.hasFinalPayableTotalContext(context)) score += 25;
      if (isWritten) score += 20;
      if (reasonText.indexOf("noisy agent") !== -1 && reasonText.indexOf("explicit total") !== -1) score += 30;
      if (candidate.zone === "footer") score += 10;
      if (this.containsAnyKeyword(context, this.moneyKeywords.ttc || [])) score += 10;

      if (isWritten && (!bestWritten || score > bestWritten.score)) {
        bestWritten = { candidate, score };
      }

      if (isExplicitTotal && (!bestExplicitTotal || score > bestExplicitTotal.score)) {
        bestExplicitTotal = { candidate, score };
      }

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (bestWritten && bestExplicitTotal) {
      const writtenValue = bestWritten.candidate.value;
      const explicitValue = bestExplicitTotal.candidate.value;
      const diff = Math.abs(writtenValue - explicitValue);
      const explicitReasonText = Array.isArray(bestExplicitTotal.candidate.reasons)
        ? bestExplicitTotal.candidate.reasons.join(" ").toLowerCase()
        : "";
      const tolerance = explicitReasonText.indexOf("noisy agent") !== -1 &&
        explicitReasonText.indexOf("explicit total") !== -1
        ? Math.max(15, explicitValue * 0.05)
        : Math.max(15, explicitValue * 0.01);

      if (diff > 0 && diff <= tolerance) {
        return bestExplicitTotal.candidate;
      }
    }

    return best;
  }

  selectStandaloneTvaCandidate(candidates, ttcValue) {
    const list = candidates || [];
    let best = null;
    let bestScore = -1;

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate) continue;

      let score = typeof candidate.score === "number" ? candidate.score : 0;
      const context = this.toLowerCaseSafe(candidate.context || "");
      const hasExplicitTvaContext = this.containsAnyKeyword(context, this.moneyKeywords.tva || []);

      if (!candidate.hasExplicitType && !hasExplicitTvaContext) {
        continue;
      }

      if (candidate.hasExplicitType) score += 15;
      if (hasExplicitTvaContext) score += 15;
      if (!Number.isInteger(candidate.value)) score += 10;

      if (typeof ttcValue === "number" && ttcValue > 0) {
        if (candidate.value <= 0 || candidate.value >= ttcValue || candidate.value > ttcValue * 0.5) {
          continue;
        }
        score += 15;
      }

      if (candidate.value <= 30 && Number.isInteger(candidate.value)) {
        score -= 40;
      }

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  selectStandaloneHtCandidate(candidates, ttcValue) {
    const list = candidates || [];
    let best = null;
    let bestScore = -1;

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate) continue;

      let score = typeof candidate.score === "number" ? candidate.score : 0;
      const context = this.toLowerCaseSafe(candidate.context || "");
      const hasExplicitHtContext = this.containsAnyKeyword(context, this.moneyKeywords.ht || []);

      if (!candidate.hasExplicitType && !hasExplicitHtContext) {
        continue;
      }

      if (candidate.hasExplicitType) score += 15;
      if (hasExplicitHtContext) score += 15;
      if (candidate.zone === "footer") score += 12;
      if (candidate.value <= 50) score -= 50;

      if (typeof ttcValue === "number" && ttcValue > 0) {
        if (candidate.value <= 0 || candidate.value >= ttcValue) {
          continue;
        }

        const ratio = candidate.value / ttcValue;
        if (ratio < 0.5 || ratio > 0.99) {
          score -= 25;
        } else {
          score += 20;
        }
      }

      score += Math.min(25, candidate.value / 500);

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  selectBestValidatedTriplet(triplets) {
    const list = triplets || [];
    if (list.length === 0) return null;

    const tripletPriority = (triplet) => {
      if (!triplet) return -1;

      let score = typeof triplet.score === "number" ? triplet.score : 0;
      const ttc = triplet.ttc || {};
      const ht = triplet.ht || {};
      const tva = triplet.tva || {};
      const ttcContext = this.toLowerCaseSafe(ttc.context || "");

      if (ttc.zone === "footer") score += 20;
      if (ht.zone === "footer") score += 8;
      if (tva.zone === "footer") score += 8;
      if (ttc.hasExplicitType) score += 15;
      if (ht.hasExplicitType) score += 10;
      if (tva.hasExplicitType) score += 10;
      if (this.containsAnyKeyword(ttcContext, this.moneyKeywords.ttc || [])) score += 20;
      if (this.containsAnyKeyword(ttcContext, this.moneyKeywords.ht || []) ||
          this.containsAnyKeyword(ttcContext, this.moneyKeywords.tva || [])) {
        score += 6;
      }
      const combinedContext = [
        ht.context || "",
        tva.context || "",
        ttc.context || ""
      ].join(" ");
      if (this.containsPhonePattern(combinedContext)) score -= 80;
      if (this.containsEmailPattern(combinedContext)) score -= 80;
      if (this.containsAnyKeyword(this.toLowerCaseSafe(combinedContext), this.excludeKeywords || [])) {
        score -= 30;
      }
      if (typeof ttc.value === "number" && ttc.value > 0) {
        score += Math.min(25, ttc.value / 1000);
      }

      return score;
    };

    let best = list[0];
    for (let i = 1; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate) continue;

      const bestDiff = typeof best.mathDiff === "number" ? best.mathDiff : Number.MAX_SAFE_INTEGER;
      const candidateDiff = typeof candidate.mathDiff === "number" ? candidate.mathDiff : Number.MAX_SAFE_INTEGER;
      if (candidateDiff + 0.01 < bestDiff) {
        best = candidate;
        continue;
      }
      if (bestDiff + 0.01 < candidateDiff) {
        continue;
      }

      const bestConsistency = typeof best.consistency === "number" ? best.consistency : 0;
      const candidateConsistency = typeof candidate.consistency === "number" ? candidate.consistency : 0;
      if (candidateConsistency > bestConsistency + 0.01) {
        best = candidate;
        continue;
      }
      if (bestConsistency > candidateConsistency + 0.01) {
        continue;
      }

      const bestScore = typeof best.score === "number" ? best.score : 0;
      const candidateScore = typeof candidate.score === "number" ? candidate.score : 0;
      if (candidateScore > bestScore) {
        best = candidate;
        continue;
      }
      if (bestScore > candidateScore) {
        continue;
      }

      const bestPriority = tripletPriority(best);
      const candidatePriority = tripletPriority(candidate);
      if (candidatePriority > bestPriority + 0.01) {
        best = candidate;
        continue;
      }
      if (bestPriority > candidatePriority + 0.01) {
        continue;
      }

      const bestTtc = best.ttc && typeof best.ttc.value === "number" ? best.ttc.value : 0;
      const candidateTtc = candidate.ttc && typeof candidate.ttc.value === "number" ? candidate.ttc.value : 0;
      if (candidateTtc > bestTtc + 0.01) {
        best = candidate;
      }
    }

    return best;
  }

  // =========================================================================
  // STEP 6: AMOUNT VALIDATION
  // =========================================================================

  /**
   * Validate and select the best amounts from scored candidates
   */
  validateAmounts(scoredCandidates, classifiedLines) {
    const result = {
      montantHt: null,
      tva: null,
      montantTtc: null,
      validationNotes: []
    };

    // First, try to use validated triplets
    const triplets = scoredCandidates.money.triplets;
    const money = scoredCandidates.money || {};
    const topTtc = this.selectStandaloneTtcCandidate(money.ttc);

    if (triplets.length > 0) {
      const bestTriplet = this.selectBestValidatedTriplet(triplets);
      const topTtcContext = topTtc ? this.toLowerCaseSafe(topTtc.context) : "";
      const explicitHt = this.selectStandaloneHtCandidate(money.ht, topTtc ? topTtc.value : null);
      const explicitTva = this.selectStandaloneTvaCandidate(money.tva, topTtc ? topTtc.value : null);

      if (topTtc && explicitHt && explicitTva) {
        const explicitDiff = Math.abs((explicitHt.value + explicitTva.value) - topTtc.value);
        const explicitTolerance = Math.max(1, topTtc.value * 0.03);
        const explicitLooksLikeFinalTotals =
          this.containsAnyKeyword(this.toLowerCaseSafe(explicitHt.context || ""), this.moneyKeywords.ht || []) &&
          this.containsAnyKeyword(this.toLowerCaseSafe(explicitTva.context || ""), this.moneyKeywords.tva || []) &&
          this.containsAnyKeyword(topTtcContext, this.moneyKeywords.ttc || []);

        if (explicitDiff <= explicitTolerance &&
            explicitLooksLikeFinalTotals &&
            bestTriplet &&
            topTtc.value > bestTriplet.ttc.value * 1.2) {
          result.montantHt = explicitHt.value;
          result.tva = explicitTva.value;
          result.montantTtc = topTtc.value;
          result.validationNotes.push("Preferred explicit totals block over smaller validated triplet");
          return result;
        }
      }

      if (topTtc &&
          topTtc.score >= 80 &&
          topTtc.value > bestTriplet.ttc.value * 1.5 &&
          (this.containsSubstring(topTtcContext, "montant a payer") ||
           this.containsSubstring(topTtcContext, "montant Ã  payer") ||
           this.containsSubstring(topTtcContext, "net a payer") ||
           this.containsSubstring(topTtcContext, "net Ã  payer"))) {
        result.montantHt = null;
        result.tva = null;
        result.montantTtc = topTtc.value;
        result.validationNotes.push("Preferred explicit payable total over smaller line-item triplet");
        return result;
      }

      if (topTtc &&
          topTtc.score >= 80 &&
          Math.abs(topTtc.value - bestTriplet.ttc.value) <= Math.max(1, topTtc.value * 0.05) &&
          (bestTriplet.tva.value < 5 || bestTriplet.ht.value < 50) &&
          (this.containsSubstring(topTtcContext, "montant a payer") ||
           this.containsSubstring(topTtcContext, "montant Ã  payer") ||
           this.containsSubstring(topTtcContext, "net a payer") ||
           this.containsSubstring(topTtcContext, "net Ã  payer"))) {
        result.montantHt = null;
        result.tva = null;
        result.montantTtc = topTtc.value;
        result.validationNotes.push("Kept payable TTC only because triplet components looked unreliable");
        return result;
      }

      result.montantHt = bestTriplet.ht.value;
      result.tva = bestTriplet.tva.value;
      result.montantTtc = bestTriplet.ttc.value;

      result.validationNotes.push("Used validated triplet with consistency: " + bestTriplet.consistency.toFixed(1) + "%");

      return result;
    }

    // Fallback: use best individual candidates
    if (money.ht && money.ht.length > 0) {
      result.montantHt = money.ht[0].value;
    }

    if (money.tva && money.tva.length > 0) {
      result.tva = money.tva[0].value;
    }

    if (topTtc) {
      result.montantTtc = topTtc.value;
    }

    if (result.montantHt !== null && result.montantTtc !== null && result.tva !== null) {
      const topTvaCandidate = money.tva && money.tva.length > 0 ? money.tva[0] : null;
      const htTtcPairLooksPlausible =
        result.montantHt > 0 &&
        result.montantTtc > result.montantHt &&
        result.montantHt >= (result.montantTtc * 0.5);
      const tvaLooksLikeRateNoise =
        result.tva > 0 &&
        result.tva <= 30 &&
        (!topTvaCandidate || topTvaCandidate.score < 60);
      const tvaBreaksArithmetic =
        Math.abs((result.montantHt + result.tva) - result.montantTtc) > Math.max(1, result.montantTtc * 0.1);

      if (htTtcPairLooksPlausible && tvaLooksLikeRateNoise && tvaBreaksArithmetic) {
        result.tva = null;
        result.validationNotes.push("Dropped weak TVA rate candidate before auto-calculation");
      }
    }

    const hasOnlyTtc = result.montantHt === null && result.tva === null && result.montantTtc !== null;
    const hasStrongPayableTtcContext = topTtc && this.hasFinalPayableTotalContext(topTtc.context || "");
    const hasStrongExplicitTtcContext =
      topTtc &&
      !!topTtc.hasExplicitType &&
      (
        this.containsAnyKeyword(this.toLowerCaseSafe(topTtc.context || ""), this.moneyKeywords.ttc || []) ||
        this.containsSubstring(this.toLowerCaseSafe(topTtc.context || ""), "total")
      );
    if (hasOnlyTtc && (!topTtc || (topTtc.score < 80 && !hasStrongPayableTtcContext && !hasStrongExplicitTtcContext))) {
      result.validationNotes.push("Rejected low-confidence TTC-only fallback");
      result.montantTtc = null;
    }

    // If the HT candidate is obviously junk but TVA + TTC look plausible,
    // drop only the HT so we can still preserve the TVA signal.
    if (result.montantHt !== null && result.tva !== null && result.montantTtc !== null) {
      const htPlusTvaDiff = Math.abs((result.montantHt + result.tva) - result.montantTtc);
      const htPlusTvaTolerance = Math.max(1, result.montantTtc * 0.1);
      const weakHtButGoodTva =
        result.montantHt > 0 &&
        result.tva > 0 &&
        result.tva < result.montantTtc &&
        (result.tva / result.montantTtc) >= 0.03 &&
        (result.tva / result.montantTtc) <= 0.35 &&
        htPlusTvaDiff > htPlusTvaTolerance &&
        (
          result.montantHt < 50 ||
          result.montantHt <= result.tva ||
          result.montantHt <= result.montantTtc * 0.3
        );

      if (weakHtButGoodTva) {
        result.montantHt = null;
        result.validationNotes.push("Dropped implausible HT candidate while keeping TVA/TTC");
      }
    }

    if (!this.isPlausiblePartialAmounts(result.montantHt, result.tva, result.montantTtc)) {
      result.validationNotes.push("Rejected implausible individual amount fallback");
      const preferredTva = this.selectStandaloneTvaCandidate(money.tva, result.montantTtc);
      result.montantHt = null;
      result.tva = preferredTva && preferredTva.score >= 60 ? preferredTva.value : null;
      if (result.tva !== null) {
        result.validationNotes.push("Kept standalone TVA candidate after rejecting inconsistent HT");
      }
      const preferredTtc = this.selectStandaloneTtcCandidate(money.ttc);
      const preferredTtcIsExplicitTotal =
        preferredTtc &&
        !!preferredTtc.hasExplicitType &&
        this.containsSubstring(this.toLowerCaseSafe(preferredTtc.context || ""), "total");
      if (preferredTtc && (preferredTtc.score >= 70 || preferredTtcIsExplicitTotal)) {
        result.montantTtc = preferredTtc.value;
        result.validationNotes.push("Kept high-confidence TTC candidate only");
      } else {
        result.montantTtc = null;
      }
    }

    // Validate consistency
    if (result.montantHt !== null && result.tva !== null && result.montantTtc !== null) {
      const expected = result.montantHt + result.tva;
      const diff = Math.abs(expected - result.montantTtc);

      if (diff > 1) {
        result.validationNotes.push("Warning: HT + TVA ≠ TTC (difference: " + diff.toFixed(2) + ")");
      }
    }

    this.appendWrittenTotalValidation(result, money);
    return result;
  }

  appendWrittenTotalValidation(result, money) {
    if (!result || result.montantTtc === null || result.montantTtc === 0) return;
    const ttcCandidates = money && money.ttc ? money.ttc : [];
    if (!ttcCandidates || ttcCandidates.length === 0) return;

    let writtenCandidate = null;
    for (let i = 0; i < ttcCandidates.length; i++) {
      const candidate = ttcCandidates[i];
      if (!candidate || !candidate.reasons) continue;
      if (candidate.reasons.indexOf("written total amount") !== -1) {
        writtenCandidate = candidate;
        break;
      }
    }

    if (!writtenCandidate) return;

    const diff = Math.abs(writtenCandidate.value - result.montantTtc);
    const tolerance = Math.max(1, result.montantTtc * 0.01);

    if (diff <= tolerance) {
      result.validationNotes.push(
        diff <= 0.01
          ? "Written amount in words confirms TTC"
          : "Written amount in words roughly matches TTC"
      );
    } else {
      result.validationNotes.push(
        "Written amount in words differs from TTC candidate (" +
        writtenCandidate.value.toFixed(2) + " vs " +
        result.montantTtc.toFixed(2) + ")"
      );
    }
  }

  detectDominantVatRate(classifiedLines) {
    const lines = classifiedLines || [];
    const rateCounts = {};
    let explicitVatContextSeen = false;

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];
      if (!lineInfo || !lineInfo.cleaned) continue;
      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      if (this.containsSubstring(lower, "tva") ||
          this.containsSubstring(lower, "vat") ||
          this.containsSubstring(lower, "taux") ||
          this.containsSubstring(lower, "tx tva")) {
        explicitVatContextSeen = true;
        break;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];
      if (!lineInfo || !lineInfo.cleaned) continue;

      const lower = this.toLowerCaseSafe(lineInfo.cleaned);
      const classification = lineInfo.classification || { types: [] };
      const hasVatContext =
        this.containsSubstring(lower, "tva") ||
        this.containsSubstring(lower, "vat") ||
        this.containsSubstring(lower, "taux") ||
        this.containsSubstring(lower, "tx tva");
      const isStandaloneBodyRateLine =
        classification.types.indexOf("noise") !== -1 &&
        i < Math.floor(lines.length * 0.8) &&
        (lineInfo.tokens || []).length === 1;

      if (!explicitVatContextSeen && !hasVatContext) {
        continue;
      }

      if (!hasVatContext && !isStandaloneBodyRateLine &&
          (classification.types.indexOf("admin") !== -1 ||
           classification.types.indexOf("reference") !== -1 ||
           classification.types.indexOf("date") !== -1 ||
           classification.types.indexOf("noise") !== -1)) {
        continue;
      }

      const tokens = lineInfo.tokens || [];
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        const normalized = this.normalizeMoneyToken(token);
        if (!normalized) continue;

        const parsed = this.parseMoneyValue(normalized);
        if (parsed === null || parsed <= 0 || parsed > 30) continue;
        if (!hasVatContext && (parsed < 5 || !Number.isInteger(parsed))) continue;

        const rounded = Math.round(parsed * 100) / 100;
        const key = rounded.toFixed(2);
        rateCounts[key] = (rateCounts[key] || 0) + (hasVatContext ? 2 : 1);
      }
    }

    let bestRate = null;
    let bestCount = 0;
    let secondBestCount = 0;
    let uniqueRates = 0;
    for (const key in rateCounts) {
      uniqueRates++;
      if (rateCounts[key] > bestCount) {
        secondBestCount = bestCount;
        bestCount = rateCounts[key];
        bestRate = parseFloat(key);
      } else if (rateCounts[key] > secondBestCount) {
        secondBestCount = rateCounts[key];
      }
    }

    if (bestCount >= 2 && bestCount > secondBestCount) return bestRate;
    if (uniqueRates === 1 && bestRate !== null) return bestRate;

    return null;
  }

  isPlausibleMoneyCombination(ht, tva, ttc) {
    if (ht === null || tva === null || ttc === null) return false;
    if (ht <= 0 || tva < 0 || ttc <= 0) return false;
    if (ttc < ht) return false;
    if (ttc < tva) return false;
    if (tva > 0 && ttc <= ht) return false;
    if (ht < 50 && ttc > 500) return false;
    if (tva > 0 && tva >= ttc) return false;

    const ratio = ht > 0 ? (tva / ht) : 0;
    if (tva > 0 && (ratio < 0.001 || ratio > 0.5)) return false;

    return true;
  }

  isPlausiblePartialAmounts(ht, tva, ttc) {
    if (ttc !== null && ttc > 0 && ht === null && tva === null) {
      return true;
    }

    if (ht !== null && ttc !== null) {
      if (ttc < ht) return false;
      if (tva !== null && tva > 0 && ttc <= ht) return false;
      if (ht < 50 && ttc > 500) return false;
      if (tva !== null) {
        const expected = ht + tva;
        const diff = Math.abs(expected - ttc);
        const tolerance = Math.max(1, expected * 0.1);
        if (diff > tolerance) return false;
      }
    }

    if (tva !== null && ttc !== null) {
      if (tva >= ttc) return false;
    }

    if (ht !== null && tva !== null) {
      const ratio = ht > 0 ? (tva / ht) : 0;
      if (tva > 0 && (ratio < 0.001 || ratio > 0.5)) return false;
    }

    return true;
  }

  // =========================================================================
  // STEP 7: BUILD FINAL RESULT
  // =========================================================================

  /**
   * Build the final structured result
   */
  buildFinalResult(validatedAmounts, scoredCandidates, classifiedLines, zones) {
    const selectedIce = this.collectRankedIceValues(scoredCandidates.ice);
    const invoicePresenceText = this.findInvoicePresenceText(classifiedLines);
    const invoicePresenceAmount = this.parseInvoicePresenceAmount(invoicePresenceText);
    const result = {
      numeroFacture: "",
      fournisseur: "",
      ice: selectedIce.values,
      dateFacture: "",
      invoicePresenceText: invoicePresenceText,
      invoicePresenceAmount: invoicePresenceAmount,
      montantHt: 0,
      tva: 0,
      tva2: 0,
      montantTtc: 0,
      confidence: {
        numeroFacture: 0,
        fournisseur: 0,
        ice: selectedIce.confidence,
        dateFacture: 0,
        montantHt: 0,
        tva: 0,
        tva2: 0,
        montantTtc: 0,
        overall: 0
      },
      missingFields: [],
      lowConfidenceFields: [],
      reviewRecommended: false
    };
    const selectionNotes = [];
    const hasAmounts =
      (validatedAmounts.montantHt || 0) > 0 ||
      (validatedAmounts.tva || 0) > 0 ||
      (validatedAmounts.montantTtc || 0) > 0;

    const globalSelection = this.makeGlobalFieldSelection(scoredCandidates, {
      hasAmounts,
      hasIce: selectedIce.values.length > 0,
      iceValues: selectedIce.values,
      classifiedLines
    });

    if (globalSelection.numeroFacture) {
      result.numeroFacture = globalSelection.numeroFacture.value;
      result.confidence.numeroFacture = this.normalizeConfidence(globalSelection.numeroFacture.score);
      if (globalSelection.numeroFacture.selectionNote) selectionNotes.push(globalSelection.numeroFacture.selectionNote);
    }

    if (globalSelection.fournisseur) {
      result.fournisseur = globalSelection.fournisseur.value;
      result.confidence.fournisseur = this.normalizeConfidence(globalSelection.fournisseur.score);
      if (globalSelection.fournisseur.selectionNote) selectionNotes.push(globalSelection.fournisseur.selectionNote);
    }

    if (globalSelection.dateFacture) {
      result.dateFacture = globalSelection.dateFacture.value;
      result.confidence.dateFacture = this.normalizeConfidence(globalSelection.dateFacture.score);
      if (globalSelection.dateFacture.selectionNote) selectionNotes.push(globalSelection.dateFacture.selectionNote);
    }

    // Extract amounts
    result.montantHt = validatedAmounts.montantHt || 0;
    result.tva = validatedAmounts.tva || 0;
    result.montantTtc = validatedAmounts.montantTtc || 0;
    result.confidence.montantHt = this.deriveAmountConfidence("ht", result.montantHt, validatedAmounts, scoredCandidates);
    result.confidence.tva = this.deriveAmountConfidence("tva", result.tva, validatedAmounts, scoredCandidates);
    result.confidence.montantTtc = this.deriveAmountConfidence("ttc", result.montantTtc, validatedAmounts, scoredCandidates);

    this.applyInvoicePresenceTtcConfirmation(result);

    const secondaryTva = this.selectSecondaryTvaCandidate(result, scoredCandidates);
    if (secondaryTva) {
      result.tva2 = secondaryTva.value;
      result.confidence.tva2 = this.normalizeConfidence(secondaryTva.score);
    }

    // Add validation notes if any
    if (validatedAmounts.validationNotes && validatedAmounts.validationNotes.length > 0) {
      if (!result.validationNotes) result.validationNotes = [];
      for (let i = 0; i < validatedAmounts.validationNotes.length; i++) {
        result.validationNotes.push(validatedAmounts.validationNotes[i]);
      }
    }
    if (selectionNotes.length > 0) {
      if (!result.validationNotes) result.validationNotes = [];
      for (let i = 0; i < selectionNotes.length; i++) {
        result.validationNotes.push(selectionNotes[i]);
      }
    }

    if (result.fournisseur &&
        result.numeroFacture === "" &&
        result.dateFacture === "" &&
        result.montantHt === 0 &&
        result.tva === 0 &&
        result.montantTtc === 0 &&
        !this.textHasStrongSupplierAnchor(result.fournisseur)) {
      result.fournisseur = "";
      result.confidence.fournisseur = 0;
    }

    result.missingFields = this.collectMissingFields(result);
    result.lowConfidenceFields = this.collectLowConfidenceFields(result);
    result.reviewRecommended = result.lowConfidenceFields.length > 0 || result.missingFields.length > 0;
    result.confidence.overall = this.computeOverallConfidence(result);
    this.learnFromExtractionResult(result);
    result.memory = {
      enabled: !!this.enableDocumentMemory,
      stats: this.getDocumentMemoryStats()
    };

    return result;
  }

  selectConsistentInvoiceCandidate(candidates, context) {
    const list = candidates || [];
    const selectionContext = context || {};
    let best = null;
    let bestScore = -1;
    const defaultValue = list.length > 0 ? list[0].value : "";

    for (let i = 0; i < Math.min(list.length, 10); i++) {
      const candidate = list[i];
      const lowerContext = this.toLowerCaseSafe(candidate && candidate.context ? candidate.context : "");
      let score = this.normalizeConfidence(candidate && candidate.score ? candidate.score : 0);

      if (candidate && candidate.zone === "header") score += 8;
      if (this.containsSubstring(lowerContext, "facture") || this.containsSubstring(lowerContext, "invoice")) score += 10;
      if (selectionContext.hasAmounts) score += 4;
      if (selectionContext.hasIce) score += 3;
      if (this.containsSubstring(lowerContext, "client") || this.containsAnyKeyword(lowerContext, this.excludeKeywords)) score -= 25;

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best) return null;

    return {
      value: best.value,
      score: best.score,
      selectionNote: best.value !== defaultValue ? "Selected alternate invoice candidate after consistency review" : ""
    };
  }

  selectConsistentSupplierCandidate(candidates, context) {
    const list = candidates || [];
    const selectionContext = context || {};
    let best = null;
    let bestScore = -1;
    let bestValue = "";
    const defaultValue = list.length > 0 ? this.trimSupplierTail(list[0].value || "") : "";

    for (let i = 0; i < Math.min(list.length, 5); i++) {
      const candidate = list[i];
      const cleaned = this.trimSupplierTail(candidate && candidate.value ? candidate.value : "");
      if (!cleaned) continue;

      const hasStrongAnchor = this.textHasStrongSupplierAnchor(cleaned);
      const hasSupplierKeyword = this.textHasSupplierKeyword(cleaned);
      const looksLikeCompactSupplier =
        cleaned.length >= 6 &&
        cleaned.length <= 30 &&
        this.countLetters(cleaned) >= 6 &&
        !this.countDigits(cleaned);
      if ((candidate.score || 0) < 45 && !((candidate.score || 0) >= 25 && hasStrongAnchor && looksLikeCompactSupplier)) continue;
      if (this.looksLikeSupplierGarbage(cleaned)) continue;
      if (cleaned.length > 40 && !hasStrongAnchor && !hasSupplierKeyword) continue;

      let score = this.normalizeConfidence(candidate && candidate.score ? candidate.score : 0);
      if (hasStrongAnchor) score += 18;
      if (hasSupplierKeyword) score += 10;
      if (selectionContext.hasAmounts) score += 6;
      if (selectionContext.hasIce) score += 8;
      if (selectionContext.numeroFacture) score += 4;
      const lowerCleaned = this.toLowerCaseSafe(cleaned);
      if (candidate && candidate.zone === "header") score += 22;
      if (candidate && candidate.zone === "header") {
        score += Math.max(0, 16 - (((candidate.lineIndex || 0) * 2)));
      }
      if (candidate &&
          candidate.zone === "header" &&
          (candidate.lineIndex || 0) <= 3 &&
          this.tokenize(cleaned).length === 1 &&
          cleaned === cleaned.toUpperCase() &&
          this.countLetters(cleaned) >= 5 &&
          this.countDigits(cleaned) === 0) {
        score += 28;
      }
      // VERY STRONG bonus for being at the very first line — almost always the supplier
      if (candidate && candidate.zone === "header" && (candidate.lineIndex || 0) <= 1) {
        score += 35;
      }
      if (candidate &&
          candidate.zone === "header" &&
          (candidate.lineIndex || 0) >= 8 &&
          this.tokenize(cleaned).length === 1 &&
          cleaned === cleaned.toUpperCase() &&
          this.countLetters(cleaned) >= 5 &&
          !this.textHasSupplierAnchor(cleaned)) {
        score -= 20;
      }
      if (candidate &&
          candidate.zone === "header" &&
          (candidate.lineIndex || 0) > 4 &&
          this.tokenize(cleaned).length === 1 &&
          cleaned === cleaned.toUpperCase() &&
          this.countLetters(cleaned) >= 8 &&
          !this.textHasSupplierAnchor(cleaned)) {
        score -= 35;
      }
      if (candidate && candidate.zone === "footer" && cleaned.length > 35) score -= 30;
      if (cleaned.length > 35 && this.containsSubstring(lowerCleaned, "capital")) score -= 30;
      if (cleaned.length > 35 && this.containsSubstring(lowerCleaned, "capltal")) score -= 30;
      if (cleaned.length > 35 && this.containsSubstring(lowerCleaned, "siege")) score -= 30;
      if (cleaned.length > 35 && this.containsSubstring(lowerCleaned, "social")) score -= 20;
      if (this.textHasExactKeyword(cleaned, this.excludeKeywords)) score -= 35;
      if (cleaned === selectionContext.numeroFacture) score -= 40;
      const lowerCleanedExact = this.toLowerCaseSafe(cleaned);
      if (lowerCleanedExact === "numero" || lowerCleanedExact === "num" || lowerCleanedExact === "number") score -= 120;

      const sourceLineIndex = candidate && typeof candidate.lineIndex === "number" ? candidate.lineIndex : -1;
      if (selectionContext.classifiedLines && sourceLineIndex >= 0) {
        const nextLine = selectionContext.classifiedLines[sourceLineIndex + 1];
        const nextTwoLine = selectionContext.classifiedLines[sourceLineIndex + 2];
        const nearbyText = [
          nextLine ? nextLine.cleaned : "",
          nextTwoLine ? nextTwoLine.cleaned : ""
        ].join(" ");
        const lowerNearby = this.toLowerCaseSafe(nearbyText);
        if (!hasStrongAnchor &&
            !hasSupplierKeyword &&
            (this.containsSubstring(lowerNearby, "ice") ||
             this.containsSubstring(lowerNearby, "rue") ||
             this.containsSubstring(lowerNearby, "gueliz") ||
             this.containsSubstring(lowerNearby, "marrakech"))) {
          score -= 45;
        }
      }

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
        bestValue = cleaned;
      }
    }

    if (!best) return null;

    return {
      value: bestValue,
      score: best.score,
      selectionNote: bestValue !== defaultValue ? "Selected alternate supplier candidate after consistency review" : ""
    };
  }

  makeGlobalFieldSelection(scoredCandidates, context) {
    const selectionContext = context || {};
    const invoiceOptions = this.buildGlobalInvoiceOptions(scoredCandidates ? scoredCandidates.numeroFacture : [], selectionContext);
    const supplierOptions = this.buildGlobalSupplierOptions(scoredCandidates ? scoredCandidates.fournisseur : [], selectionContext);
    const dateOptions = this.buildGlobalDateOptions(scoredCandidates ? scoredCandidates.dateFacture : [], selectionContext);

    let bestCombo = {
      score: -1,
      numeroFacture: null,
      fournisseur: null,
      dateFacture: null
    };

    for (let i = 0; i < invoiceOptions.length; i++) {
      for (let j = 0; j < supplierOptions.length; j++) {
        for (let k = 0; k < dateOptions.length; k++) {
          const invoice = invoiceOptions[i];
          const supplier = supplierOptions[j];
          const date = dateOptions[k];
          const score = this.computeGlobalSelectionScore(invoice, supplier, date, selectionContext);

          if (score > bestCombo.score) {
            bestCombo = {
              score,
              numeroFacture: invoice,
              fournisseur: supplier,
              dateFacture: date
            };
          }
        }
      }
    }

    return {
      numeroFacture: bestCombo.numeroFacture,
      fournisseur: bestCombo.fournisseur,
      dateFacture: bestCombo.dateFacture
    };
  }

  buildGlobalInvoiceOptions(candidates, context) {
    const selected = [];
    const best = this.selectConsistentInvoiceCandidate(candidates, context);
    if (best) selected.push(best);

    const list = candidates || [];
    for (let i = 0; i < Math.min(list.length, 3); i++) {
      const candidate = list[i];
      if (!candidate) continue;
      if (selected.length > 0 && selected[0].value === candidate.value) continue;
      selected.push({
        value: candidate.value,
        score: candidate.score,
        lineIndex: candidate.lineIndex,
        zone: candidate.zone,
        context: candidate.context,
        selectionNote: "Selected alternate invoice candidate after global decision review"
      });
    }

    if (selected.length === 0) {
      selected.push(null);
    }

    return selected;
  }

  buildGlobalSupplierOptions(candidates, context) {
    const selected = [];
    const best = this.selectConsistentSupplierCandidate(candidates, context);
    if (best) selected.push(best);
    const bestScore = best && typeof best.score === "number" ? best.score : 0;

    const list = candidates || [];
    for (let i = 0; i < Math.min(list.length, 5); i++) {
      const candidate = list[i];
      if (!candidate) continue;
      const cleaned = this.trimSupplierTail(candidate.value || "");
      if (!cleaned) continue;
      if (selected.length > 0 && selected[0].value === cleaned) continue;
      if (best && (candidate.score || 0) < Math.max(35, bestScore - 20)) continue;
      selected.push({
        value: cleaned,
        score: candidate.score,
        lineIndex: candidate.lineIndex,
        zone: candidate.zone,
        context: candidate.context,
        selectionNote: "Selected alternate supplier candidate after global decision review"
      });
    }

    if (selected.length === 0) {
      selected.push(null);
    }

    return selected;
  }

  buildGlobalDateOptions(candidates, context) {
    const selected = [];
    const list = candidates || [];
    const selectionContext = context || {};
    const lines = selectionContext.classifiedLines || [];

    const factureMarkerIndices = [];
    const dueMarkerIndices = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = this.toLowerCaseSafe(line && line.cleaned ? line.cleaned : "");
      const lineIndex = line && typeof line.index === "number" ? line.index : i;
      if (this.containsSubstring(lineLower, "facturen") || this.containsSubstring(lineLower, "facture n")) {
        factureMarkerIndices.push(lineIndex);
      }
      if (this.containsSubstring(lineLower, "dateecheance") || this.containsSubstring(lineLower, "echeance")) {
        dueMarkerIndices.push(lineIndex);
      }
    }

    const isNearFactureGrid = (candidateLineIndex) => {
      for (let i = 0; i < factureMarkerIndices.length; i++) {
        const marker = factureMarkerIndices[i];
        if (candidateLineIndex > marker && candidateLineIndex <= marker + 10) return true;
      }
      return false;
    };

    const isNearDueMarker = (candidateLineIndex) => {
      for (let i = 0; i < dueMarkerIndices.length; i++) {
        const marker = dueMarkerIndices[i];
        if (candidateLineIndex === marker + 1 || candidateLineIndex === marker) return true;
      }
      return false;
    };

    let factureGridBestStamp = 0;
    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate || typeof candidate.lineIndex !== "number") continue;
      if (isNearDueMarker(candidate.lineIndex)) continue;
      if (!isNearFactureGrid(candidate.lineIndex)) continue;

      const parsed = this.parseDate(candidate.value || "");
      if (!parsed || !parsed.valid) continue;
      const stamp = parsed.year * 10000 + parsed.month * 100 + parsed.day;
      if (stamp > factureGridBestStamp) {
        factureGridBestStamp = stamp;
      }
    }

    const ranked = [];
    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate) continue;
      let adjustedScore = candidate.score || 0;
      const context = this.toLowerCaseSafe(candidate.context || "");
      const reasons = candidate.reasons || [];
      if (reasons.indexOf("mapped from facture/date grid") !== -1) adjustedScore += 40;
      if (this.containsSubstring(context, "facturen")) adjustedScore += 15;
      if (this.containsSubstring(context, "echeance") || this.containsSubstring(context, "dateecheance")) adjustedScore -= 35;

      if (typeof candidate.lineIndex === "number" && lines.length > 0) {
        if (isNearDueMarker(candidate.lineIndex)) adjustedScore -= 40;

        const parsed = this.parseDate(candidate.value || "");
        if (isNearFactureGrid(candidate.lineIndex) && parsed && parsed.valid) {
          const stamp = parsed.year * 10000 + parsed.month * 100 + parsed.day;
          if (factureGridBestStamp > 0 && stamp === factureGridBestStamp) {
            adjustedScore += 45;
          } else {
            adjustedScore += 10;
          }
        }
      }

      ranked.push({
        value: candidate.value,
        score: adjustedScore,
        lineIndex: candidate.lineIndex,
        zone: candidate.zone,
        context: candidate.context,
        selectionNote: i > 0 ? "Selected alternate date candidate after global decision review" : ""
      });
    }

    ranked.sort((a, b) => (b.score || 0) - (a.score || 0));

    for (let i = 0; i < Math.min(ranked.length, 6); i++) {
      selected.push(ranked[i]);
    }

    if (selected.length === 0) {
      selected.push(null);
    }

    return selected;
  }

  computeGlobalSelectionScore(invoice, supplier, date, context) {
    let score = 0;
    const selectionContext = context || {};

    if (invoice) score += this.normalizeConfidence(invoice.score || 0) * 0.34;
    if (supplier) score += this.normalizeConfidence(supplier.score || 0) * 0.33;
    if (date) score += this.normalizeConfidence(date.score || 0) * 0.33;

    if (selectionContext.hasAmounts) score += 4;
    if (selectionContext.hasIce) score += 4;

    if (invoice && invoice.zone === "header") score += 6;
    if (supplier && supplier.zone === "header") score += 10;
    if (date && date.zone === "header") score += 6;

    if (date) {
      const dateContext = this.toLowerCaseSafe(date.context || "");
      if (this.containsSubstring(dateContext, "date facture")) score += 28;
      if (this.containsSubstring(dateContext, "facturen")) score += 18;
      if (this.containsSubstring(dateContext, "periode")) score -= 25;
      if (this.containsSubstring(dateContext, "date limite")) score -= 25;
      if (this.containsSubstring(dateContext, "echeance")) score -= 25;
      if (this.containsSubstring(dateContext, "dateecheance")) score -= 30;
      if (this.containsSubstring(dateContext, "du ") && this.containsSubstring(dateContext, " au")) score -= 20;
    }

    if (invoice && supplier) {
      const invoiceText = this.normalizeComparableText(invoice.value || "");
      const supplierText = this.normalizeComparableText(supplier.value || "");
      if (invoiceText && invoiceText === supplierText) score -= 60;
      const supplierContext = this.toLowerCaseSafe(supplier.context || "");
      if (this.containsSubstring(supplierContext, "client")) score -= 25;
      if (this.textHasExactKeyword(supplier.value || "", this.excludeKeywords)) score -= 25;
      score += this.computeSupplierInvoiceCompatibilityBoost(supplier.value || "", invoice.value || "");
    }

    if (supplier) {
      const supplierValue = supplier.value || "";
      const lowerSupplierValue = this.toLowerCaseSafe(supplierValue);
      if (this.textHasStrongSupplierAnchor(supplierValue)) score += 18;
      else if (this.textHasSupplierAnchor(supplierValue)) score += 10;
      if (this.textHasSupplierKeyword(supplierValue)) score += 8;
      if (supplierValue.length < 8) score -= 18;
      // Bonus for being at the very first line of the document (strong supplier signal)
      if (supplier.lineIndex === 0 || supplier.lineIndex === 1) score += 20;
      if (supplierValue.length >= 10 && supplierValue.length <= 40) score += 6;
      if (this.looksLikeSupplierGarbage(supplierValue)) score -= 40;
      if (/^\s*\d/.test(supplierValue) && supplier.zone !== "header") score -= 40;
      if ((this.containsSubstring(lowerSupplierValue, "marrakech") ||
           this.containsSubstring(lowerSupplierValue, "gueliz") ||
           this.containsSubstring(lowerSupplierValue, "casablanca") ||
           this.containsSubstring(lowerSupplierValue, "centre") ||
           this.containsSubstring(lowerSupplierValue, "avenue") ||
           this.containsSubstring(lowerSupplierValue, "route") ||
           this.containsSubstring(lowerSupplierValue, "rue")) &&
          supplier.zone !== "header") {
        score -= 35;
      }
      if (this.looksLikeAddressFragment(supplierValue) &&
          !this.textHasSupplierKeyword(supplierValue) &&
          !this.textHasSupplierAnchor(supplierValue)) {
        score -= 45;
      }
      if (supplier.zone === "header" &&
          this.tokenize(supplierValue).length === 1 &&
          supplierValue === supplierValue.toUpperCase() &&
          this.countLetters(supplierValue) >= 5 &&
          this.countDigits(supplierValue) === 0) {
        score += 24;
      }
      // Bonus for short brand names at L0/L1 even with digits (e.g., "1PORT", "3M")
      if (supplier.zone === "header" &&
          (supplier.lineIndex === 0 || supplier.lineIndex === 1) &&
          this.tokenize(supplierValue).length === 1 &&
          supplierValue.length >= 3 &&
          supplierValue.length <= 8) {
        score += 24;
      }
      if (supplier.zone === "header" &&
          this.countDigits(supplierValue) === 0 &&
          this.tokenize(supplierValue).length >= 2 &&
          this.tokenize(supplierValue).length <= 4 &&
          (this.textHasStrongSupplierAnchor(supplierValue) || this.textHasSupplierKeyword(supplierValue))) {
        score += 14;
      }
    }

    if (invoice && date) {
      const invoiceLine = typeof invoice.lineIndex === "number" ? invoice.lineIndex : 999;
      const dateLine = typeof date.lineIndex === "number" ? date.lineIndex : 999;
      const lineGap = Math.abs(invoiceLine - dateLine);
      if (lineGap <= 3) score += 8;
      else if (lineGap <= 8) score += 3;
    }

    if (supplier && date) {
      const supplierLine = typeof supplier.lineIndex === "number" ? supplier.lineIndex : 999;
      const dateLine = typeof date.lineIndex === "number" ? date.lineIndex : 999;
      const lineGap = Math.abs(supplierLine - dateLine);
      if (lineGap <= 6) score += 5;
    }

    if (supplier && selectionContext.iceValues) {
      score += this.computeSupplierIceCompatibilityBoost(supplier.value || "", selectionContext.iceValues);
    }

    if (invoice && supplier && date) {
      const zones = [invoice.zone, supplier.zone, date.zone];
      let headerCount = 0;
      for (let i = 0; i < zones.length; i++) {
        if (zones[i] === "header") headerCount++;
      }
      if (headerCount >= 2) score += 8;
    }

    return score;
  }

  buildFeatureSnapshot(preprocessed, zones, classifiedLines, scoredCandidates, validatedAmounts, result) {
    const lines = preprocessed && preprocessed.lines ? preprocessed.lines : [];
    const lowTrustLineCount = this.countLowTrustLines(lines);
    const featureSnapshot = {
      document: {
        totalLines: lines.length,
        lowTrustLineCount: lowTrustLineCount,
        lowTrustRatio: lines.length > 0 ? this.roundFeatureValue(lowTrustLineCount / lines.length) : 0,
        headerLineCount: zones && zones.header && zones.header.lines ? zones.header.lines.length : 0,
        bodyLineCount: zones && zones.body && zones.body.lines ? zones.body.lines.length : 0,
        footerLineCount: zones && zones.footer && zones.footer.lines ? zones.footer.lines.length : 0
      },
      selected: {
        numeroFacture: result.numeroFacture,
        fournisseur: result.fournisseur,
        ice: result.ice,
        dateFacture: result.dateFacture,
        montantHt: result.montantHt,
        tva: result.tva,
        montantTtc: result.montantTtc
      },
      fields: {
        numeroFacture: this.buildFieldCandidateFeatures(scoredCandidates.numeroFacture, "reference", lines.length),
        fournisseur: this.buildFieldCandidateFeatures(scoredCandidates.fournisseur, "supplier", lines.length),
        ice: this.buildFieldCandidateFeatures(scoredCandidates.ice, "admin", lines.length),
        dateFacture: this.buildFieldCandidateFeatures(scoredCandidates.dateFacture, "date", lines.length),
        montantHt: this.buildFieldCandidateFeatures(scoredCandidates.money ? scoredCandidates.money.ht : [], "money", lines.length),
        tva: this.buildFieldCandidateFeatures(scoredCandidates.money ? scoredCandidates.money.tva : [], "money", lines.length),
        montantTtc: this.buildFieldCandidateFeatures(scoredCandidates.money ? scoredCandidates.money.ttc : [], "money", lines.length)
      },
      money: {
        tripletCount: scoredCandidates.money && scoredCandidates.money.triplets ? scoredCandidates.money.triplets.length : 0,
        topTriplet: this.buildTripletFeature(scoredCandidates.money && scoredCandidates.money.triplets ? scoredCandidates.money.triplets[0] : null, lines.length),
        validatedAmounts: {
          montantHt: validatedAmounts.montantHt,
          tva: validatedAmounts.tva,
          montantTtc: validatedAmounts.montantTtc,
          validationNotes: validatedAmounts.validationNotes || []
        }
      },
      review: {
        missingFields: result.missingFields || [],
        lowConfidenceFields: result.lowConfidenceFields || [],
        reviewRecommended: !!result.reviewRecommended
      },
      memory: this.getDocumentMemoryStats(),
      weightsSource: this.learnedWeightsSource
    };

    return featureSnapshot;
  }

  buildDiagnosticsSnapshot(preprocessed, zones, classifiedLines, candidates, scoredCandidates, validatedAmounts) {
    return {
      lineSummary: {
        total: preprocessed && preprocessed.lines ? preprocessed.lines.length : 0,
        lowTrust: this.countLowTrustLines(preprocessed && preprocessed.lines ? preprocessed.lines : [])
      },
      candidateCounts: {
        numeroFacture: candidates && candidates.numeroFacture ? candidates.numeroFacture.length : 0,
        fournisseur: candidates && candidates.fournisseur ? candidates.fournisseur.length : 0,
        ice: candidates && candidates.ice ? candidates.ice.length : 0,
        dateFacture: candidates && candidates.dateFacture ? candidates.dateFacture.length : 0,
        montantHt: candidates && candidates.montantHt ? candidates.montantHt.length : 0,
        tva: candidates && candidates.tva ? candidates.tva.length : 0,
        montantTtc: candidates && candidates.montantTtc ? candidates.montantTtc.length : 0
      },
      zoneBoundaries: {
        header: zones && zones.header ? { start: zones.header.start, end: zones.header.end } : null,
        body: zones && zones.body ? { start: zones.body.start, end: zones.body.end } : null,
        footer: zones && zones.footer ? { start: zones.footer.start, end: zones.footer.end } : null
      },
      validationNotes: validatedAmounts.validationNotes || [],
      topCandidates: {
        numeroFacture: this.takeTopCandidates(scoredCandidates.numeroFacture, 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0),
        fournisseur: this.takeTopCandidates(scoredCandidates.fournisseur, 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0),
        ice: this.takeTopCandidates(scoredCandidates.ice, 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0),
        dateFacture: this.takeTopCandidates(scoredCandidates.dateFacture, 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0),
        montantHt: this.takeTopCandidates(scoredCandidates.money ? scoredCandidates.money.ht : [], 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0),
        tva: this.takeTopCandidates(scoredCandidates.money ? scoredCandidates.money.tva : [], 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0),
        montantTtc: this.takeTopCandidates(scoredCandidates.money ? scoredCandidates.money.ttc : [], 3, preprocessed && preprocessed.lines ? preprocessed.lines.length : 0)
      }
    };
  }

  buildFieldCandidateFeatures(candidates, kind, totalLines) {
    const list = candidates || [];
    const features = [];

    for (let i = 0; i < list.length; i++) {
      features.push(this.buildCandidateFeature(list[i], kind, totalLines));
    }

    return {
      candidateCount: list.length,
      topScore: list.length > 0 ? this.normalizeConfidence(list[0].score) : 0,
      scoreGapTop2: this.computeTopScoreGap(list),
      candidates: features.slice(0, 5)
    };
  }

  buildCandidateFeature(candidate, kind, totalLines) {
    if (!candidate) return null;

    const context = candidate.context || "";
    const lowerContext = this.toLowerCaseSafe(context);
    const linePosition = totalLines > 0 && typeof candidate.lineIndex === "number"
      ? this.roundFeatureValue(candidate.lineIndex / Math.max(1, totalLines - 1))
      : 0;

    return {
      value: candidate.value,
      score: this.normalizeConfidence(candidate.score),
      heuristicScore: this.normalizeConfidence(candidate.heuristicScore || candidate.score),
      mlScore: this.normalizeConfidence(candidate.mlScore || 0),
      zone: candidate.zone || "",
      lineIndex: typeof candidate.lineIndex === "number" ? candidate.lineIndex : -1,
      linePosition: linePosition,
      tokenCount: this.tokenize(String(candidate.value || "")).length,
      charLength: String(candidate.value || "").length,
      hasExplicitType: !!candidate.hasExplicitType,
      hasInvoiceKeyword: this.containsAnyKeyword(lowerContext, this.invoiceKeywords),
      hasDateKeyword: this.containsAnyKeyword(lowerContext, this.dateKeywords),
      hasSupplierKeyword: kind === "supplier" ? this.textHasSupplierKeyword(context) : false,
      hasSupplierAnchor: kind === "supplier" ? this.textHasSupplierAnchor(context) : false,
      hasTotalKeyword: this.containsSubstring(lowerContext, "total"),
      hasPayableKeyword:
        this.containsSubstring(lowerContext, "montant a payer") ||
        this.containsSubstring(lowerContext, "montant ÃƒÂ  payer") ||
        this.containsSubstring(lowerContext, "net a payer") ||
        this.containsSubstring(lowerContext, "net ÃƒÂ  payer"),
      looksLikeReference: kind === "reference" ? this.looksLikeReference(String(candidate.value || "")) : false,
      parsedAsDate: kind === "date" ? !!(candidate.parsed && candidate.parsed.valid) : false,
      looksLikeMoney: kind === "money" ? this.looksLikeMoney(String(candidate.raw || candidate.value || "")) : false,
      modelFeatures: candidate.mlFeatures || null,
      reasons: candidate.reasons ? candidate.reasons.slice(0, 6) : []
    };
  }

  buildTripletFeature(triplet, totalLines) {
    if (!triplet) return null;

    const maxLineDiff = Math.max(
      Math.abs((triplet.ht ? triplet.ht.lineIndex : 0) - (triplet.tva ? triplet.tva.lineIndex : 0)),
      Math.abs((triplet.ht ? triplet.ht.lineIndex : 0) - (triplet.ttc ? triplet.ttc.lineIndex : 0)),
      Math.abs((triplet.tva ? triplet.tva.lineIndex : 0) - (triplet.ttc ? triplet.ttc.lineIndex : 0))
    );

    return {
      score: this.normalizeConfidence(triplet.score),
      heuristicScore: this.normalizeConfidence(triplet.heuristicScore || triplet.score),
      mlScore: this.normalizeConfidence(triplet.mlScore || 0),
      consistency: this.roundFeatureValue(triplet.consistency || 0),
      maxLineDiff: maxLineDiff,
      compactness: totalLines > 0 ? this.roundFeatureValue(1 - (maxLineDiff / Math.max(1, totalLines - 1))) : 1,
      values: {
        ht: triplet.ht ? triplet.ht.value : null,
        tva: triplet.tva ? triplet.tva.value : null,
        ttc: triplet.ttc ? triplet.ttc.value : null
      },
      explicitTypes:
        !!(triplet.ht && triplet.ht.hasExplicitType) &&
        !!(triplet.tva && triplet.tva.hasExplicitType) &&
        !!(triplet.ttc && triplet.ttc.hasExplicitType),
      modelFeatures: triplet.mlFeatures || null,
      reasons: triplet.reasons ? triplet.reasons.slice(0, 6) : []
    };
  }

  takeTopCandidates(candidates, limit, totalLines) {
    const list = candidates || [];
    const top = [];
    const max = Math.min(limit || 3, list.length);

    for (let i = 0; i < max; i++) {
      top.push(this.buildCandidateFeature(list[i], "generic", totalLines));
    }

    return top;
  }

  computeTopScoreGap(candidates) {
    if (!candidates || candidates.length < 2) return 0;
    return this.normalizeConfidence((candidates[0].score || 0) - (candidates[1].score || 0));
  }

  countLowTrustLines(lines) {
    const list = lines || [];
    let count = 0;

    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].lowTrust) count++;
    }

    return count;
  }

  roundFeatureValue(value) {
    if (typeof value !== "number" || isNaN(value)) return 0;
    return Math.round(value * 1000) / 1000;
  }

  normalizeConfidence(score) {
    if (typeof score !== "number" || isNaN(score)) return 0;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  deriveAmountConfidence(type, selectedValue, validatedAmounts, scoredCandidates) {
    if (selectedValue === null || selectedValue === undefined || selectedValue === 0) {
      return 0;
    }

    const money = scoredCandidates.money || {};
    const triplets = money.triplets || [];
    const topTriplet = triplets.length > 0 ? triplets[0] : null;
    let matchedCandidate = null;

    if (type === "ht") {
      matchedCandidate = this.findCandidateByValue(money.ht, selectedValue);
    } else if (type === "tva") {
      matchedCandidate = this.findCandidateByValue(money.tva, selectedValue);
    } else if (type === "ttc") {
      matchedCandidate = this.findCandidateByValue(money.ttc, selectedValue);
    }

    let confidence = matchedCandidate ? this.normalizeConfidence(matchedCandidate.score) : 0;

    if (topTriplet) {
      const tripletMatches =
        Math.abs((topTriplet.ht && topTriplet.ht.value) - (validatedAmounts.montantHt || 0)) < 0.01 &&
        Math.abs((topTriplet.tva && topTriplet.tva.value) - (validatedAmounts.tva || 0)) < 0.01 &&
        Math.abs((topTriplet.ttc && topTriplet.ttc.value) - (validatedAmounts.montantTtc || 0)) < 0.01;

      if (tripletMatches) {
        if (type === "ttc") {
          confidence = Math.max(confidence, this.normalizeConfidence(topTriplet.score));
        } else {
          confidence = Math.max(confidence, Math.min(100, this.normalizeConfidence(topTriplet.score) + 5));
        }
      }
    }

    if (type === "tva" &&
        (!matchedCandidate || confidence === 0) &&
        validatedAmounts.validationNotes &&
        this.arrayContainsSubstring(validatedAmounts.validationNotes, "TVA calculated as TTC - HT")) {
      const htConfidence = this.deriveAmountConfidence("ht", validatedAmounts.montantHt, {
        montantHt: validatedAmounts.montantHt,
        tva: null,
        montantTtc: validatedAmounts.montantTtc,
        validationNotes: []
      }, scoredCandidates);
      const ttcConfidence = this.deriveAmountConfidence("ttc", validatedAmounts.montantTtc, {
        montantHt: validatedAmounts.montantHt,
        tva: null,
        montantTtc: validatedAmounts.montantTtc,
        validationNotes: []
      }, scoredCandidates);
      confidence = Math.max(0, Math.min(htConfidence, ttcConfidence) - 10);
    }

    if (validatedAmounts.validationNotes && validatedAmounts.validationNotes.length > 0) {
      if (type === "ttc" &&
          this.arrayContainsSubstring(validatedAmounts.validationNotes, "Recalculated TTC from HT + TVA")) {
        confidence = Math.max(confidence, 75);
      }

      if ((type === "ht" || type === "tva") &&
          this.arrayContainsSubstring(validatedAmounts.validationNotes, "Rejected implausible individual amount fallback")) {
        confidence = Math.min(confidence, 45);
      }

      if (type === "ttc" &&
          this.arrayContainsSubstring(validatedAmounts.validationNotes, "Kept high-confidence TTC candidate only")) {
        confidence = Math.max(confidence, 80);
      }
    }

    return this.normalizeConfidence(confidence);
  }

  findCandidateByValue(candidates, value) {
    if (!candidates || typeof value !== "number") return null;

    for (let i = 0; i < candidates.length; i++) {
      if (Math.abs(candidates[i].value - value) < 0.01) {
        return candidates[i];
      }
    }

    return null;
  }

  selectSecondaryTvaCandidate(result, scoredCandidates) {
    if (!result || !scoredCandidates || !scoredCandidates.money) return null;
    if (!result.montantHt || !result.tva || !result.montantTtc) return null;

    const tvaCandidates = scoredCandidates.money.tva || [];
    let best = null;
    let bestScore = -1;

    for (let i = 0; i < tvaCandidates.length; i++) {
      const candidate = tvaCandidates[i];
      if (!candidate || typeof candidate.value !== "number") continue;
      if (Math.abs(candidate.value - result.tva) < 0.01) continue;
      if (candidate.value <= 30 && Number.isInteger(candidate.value)) continue;

      const normalizedScore = this.normalizeConfidence(candidate.score || 0);
      const reasons = Array.isArray(candidate.reasons) ? candidate.reasons : [];
      const reasonText = reasons.join(" ").toLowerCase();
      const contextText = String(candidate.context || "").toLowerCase();
      const hasExplicitTvaContext = this.containsAnyKeyword(contextText, this.moneyKeywords.tva || []);
      const hasExplicitVatRateLabel =
        this.containsSubstring(contextText, "tva10") ||
        this.containsSubstring(contextText, "tva 10") ||
        this.containsSubstring(contextText, "tva20") ||
        this.containsSubstring(contextText, "tva 20") ||
        this.containsSubstring(contextText, "%");
      const isStructuredDualVatCandidate =
        reasonText.indexOf("dual tva footer") !== -1 ||
        reasonText.indexOf("explicit second tva") !== -1;
      const hasAdminFooterNoise =
        reasonText.indexOf("admin/client context") !== -1 ||
        contextText.indexOf("taxe professionnelle") !== -1 ||
        contextText.indexOf("producteur fiscal") !== -1 ||
        contextText.indexOf("identifiant fiscal") !== -1 ||
        contextText.indexOf("if.") !== -1 ||
        contextText.indexOf("i.f.") !== -1 ||
        contextText.indexOf("cnss") !== -1 ||
        contextText.indexOf("rc") !== -1 ||
        contextText.indexOf("ice") !== -1;
      const effectiveScore = normalizedScore + (hasExplicitVatRateLabel ? 8 : 0);
      const looksLikeWeakRate =
        candidate.value <= 5 &&
        !Number.isInteger(result.tva) &&
        (reasonText.includes("likely a tax rate") ||
         reasonText.includes("suspiciously tiny amount") ||
         contextText.includes("taxe professionnelle") ||
         contextText.includes("ice") ||
         contextText.includes("service.client"));

      if (effectiveScore < 60 || looksLikeWeakRate || !candidate.hasExplicitType || !hasExplicitTvaContext) continue;
      if (hasAdminFooterNoise) continue;
      if (!hasExplicitVatRateLabel && !isStructuredDualVatCandidate) continue;

      const closesTtcGap =
        Math.abs((result.montantHt + result.tva + candidate.value) - result.montantTtc) <=
        Math.max(1, result.montantTtc * 0.02);

      const expectedTtc = Math.round((result.montantHt + result.tva + candidate.value) * 100) / 100;
      const diff = Math.abs(expectedTtc - result.montantTtc);
      const tolerance = Math.max(1, result.montantTtc * 0.02);

      // Keep a smaller secondary VAT amount when it explicitly appears as TVA
      // and it closes the remaining TTC arithmetic gap.
      if (!closesTtcGap &&
          candidate.value <= Math.max(100, result.montantTtc * 0.02, result.tva * 0.15)) {
        continue;
      }

      if (diff > tolerance) continue;

      if (effectiveScore > bestScore) {
        best = candidate;
        bestScore = effectiveScore;
      }
    }

    return best;
  }

  collectLowConfidenceFields(result) {
    const fields = [];
    const fieldNames = [
      "numeroFacture",
      "fournisseur",
      "ice",
      "dateFacture",
      "montantHt",
      "tva",
      "montantTtc"
    ];

    for (let i = 0; i < fieldNames.length; i++) {
      const field = fieldNames[i];
      const value = result[field];
      const hasValue = this.fieldHasValue(value);
      if (!hasValue) continue;

      if ((result.confidence[field] || 0) < this.lowConfidenceThreshold) {
        fields.push(field);
      }
    }

    return fields;
  }

  collectMissingFields(result) {
    const fields = [];
    const fieldNames = [
      "numeroFacture",
      "fournisseur",
      "dateFacture",
      "montantTtc"
    ];

    for (let i = 0; i < fieldNames.length; i++) {
      const field = fieldNames[i];
      const value = result[field];
      const missing = !this.fieldHasValue(value);
      if (missing) {
        fields.push(field);
      }
    }

    return fields;
  }

  computeOverallConfidence(result) {
    const fieldNames = [
      "numeroFacture",
      "fournisseur",
      "ice",
      "dateFacture",
      "montantHt",
      "tva",
      "montantTtc"
    ];
    let total = 0;
    let count = 0;

    for (let i = 0; i < fieldNames.length; i++) {
      const field = fieldNames[i];
      const value = result[field];
      const hasValue = this.fieldHasValue(value);
      if (!hasValue) continue;

      total += result.confidence[field] || 0;
      count++;
    }

    if (count === 0) return 0;
    return this.normalizeConfidence(total / count);
  }

  arrayContainsSubstring(values, needle) {
    if (!values || !needle) return false;

    for (let i = 0; i < values.length; i++) {
      if (this.containsSubstring(values[i], needle)) {
        return true;
      }
    }

    return false;
  }

  collectRankedIceValues(candidates) {
    const list = candidates || [];
    const values = [];
    let bestConfidence = 0;

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      if (!candidate || !candidate.value) continue;
      if (!this.arrayContainsExactValue(values, candidate.value)) {
        values.push(candidate.value);
      }
      bestConfidence = Math.max(bestConfidence, this.normalizeConfidence(candidate.score || 0));
    }

    return {
      values,
      confidence: bestConfidence
    };
  }

  extractIceNumberFromTokens(tokens) {
    const list = tokens || [];

    for (let i = 0; i < list.length; i++) {
      const tokenLower = this.toLowerCaseSafe(this.normalizeFrenchWord(list[i] || ""));
      if (!this.containsSubstring(tokenLower, "ice")) continue;

      const inlineDigits = this.extractDigitsOnly(list[i]);
      if (this.isLikelyIceNumber(inlineDigits)) {
        return inlineDigits;
      }

      for (let j = i + 1; j < Math.min(list.length, i + 5); j++) {
        const candidate = this.extractDigitsOnly(list[j]);
        if (this.isLikelyIceNumber(candidate)) {
          return candidate;
        }
      }
    }

    return "";
  }

  extractStandaloneIceNumber(tokens) {
    const list = tokens || [];

    for (let i = 0; i < list.length; i++) {
      const candidate = this.extractDigitsOnly(list[i]);
      if (this.isLikelyIceNumber(candidate)) {
        return candidate;
      }
    }

    return "";
  }

  isIceMarkerOnlyLine(tokens) {
    const list = tokens || [];
    if (list.length === 0 || list.length > 2) return false;

    for (let i = 0; i < list.length; i++) {
      const tokenLower = this.toLowerCaseSafe(this.normalizeFrenchWord(list[i] || ""));
      if (tokenLower === "ice") return true;
    }

    return false;
  }

  hasExactToken(tokens, expected) {
    const list = tokens || [];
    const normalizedExpected = this.toLowerCaseSafe(expected || "");

    for (let i = 0; i < list.length; i++) {
      const tokenLower = this.toLowerCaseSafe(this.normalizeFrenchWord(list[i] || ""));
      if (tokenLower === normalizedExpected) {
        return true;
      }
    }

    return false;
  }

  isLikelyIceNumber(value) {
    if (!value) return false;
    return value.length >= 14 && value.length <= 16;
  }

  extractDigitsOnly(str) {
    let result = "";

    for (let i = 0; i < (str || "").length; i++) {
      const code = str.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        result += str[i];
      }
    }

    return result;
  }

  arrayContainsExactValue(values, expected) {
    const list = values || [];

    for (let i = 0; i < list.length; i++) {
      if (list[i] === expected) {
        return true;
      }
    }

    return false;
  }

  deduplicateFieldCandidates(candidates) {
    const list = candidates || [];
    const byValue = {};
    const order = [];

    const candidatePriority = (candidate) => {
      if (!candidate) return -1;
      let score = 0;
      if (candidate.hasExplicitType) score += 40;
      if (candidate.zone === "footer") score += 20;
      if (candidate.zone === "body") score += 5;

      const reasons = Array.isArray(candidate.reasons) ? candidate.reasons.join(" ").toLowerCase() : "";
      const context = this.toLowerCaseSafe(candidate.context || "");

      if (reasons.indexOf("noisy agent dual tva footer") !== -1) score += 60;
      if (reasons.indexOf("noisy agent") !== -1 && reasons.indexOf("explicit total") !== -1) score += 50;
      if (context && this.containsSubstring(context, "tva")) score += 15;
      if (context && this.containsSubstring(context, "net a payer")) score += 10;
      if (context && this.containsSubstring(context, "netapayer")) score += 10;
      if (typeof candidate.score === "number") score += candidate.score * 0.01;
      score += Math.min(String(candidate.context || "").length, 120) * 0.01;

      return score;
    };

    for (let i = 0; i < list.length; i++) {
      const candidate = list[i];
      const key = candidate && candidate.value ? String(candidate.value) : "";
      if (!key) continue;

      if (!Object.prototype.hasOwnProperty.call(byValue, key)) {
        byValue[key] = candidate;
        order.push(key);
        continue;
      }

      if (candidatePriority(candidate) > candidatePriority(byValue[key])) {
        byValue[key] = candidate;
      }
    }

    const result = [];
    for (let i = 0; i < order.length; i++) {
      result.push(byValue[order[i]]);
    }

    return result;
  }

  fieldHasValue(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return value !== "";
  }

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  hasInvoicePresencePhrase(text) {
    const lower = this.toLowerCaseSafe(text || "");
    if (!lower) return false;

    if (this.containsAnyKeyword(lower, this.invoicePresencePhrases || [])) {
      return true;
    }

    const hasMontantTotal = this.containsSubstring(lower, "montant total") || this.containsSubstring(lower, "toutes taxes comprises") || this.containsSubstring(lower, "dirhams");

    const hasPresenteFacture = this.containsSubstring(lower, "presente facture") || this.containsSubstring(lower, "présente facture");
    const hasSomme = this.containsSubstring(lower, "somme de");
    const hasFactureActuelle = this.containsSubstring(lower, "facture actuelle");
    const hasArreteVerb =
      this.containsSubstring(lower, "arrete") ||
      this.containsSubstring(lower, "arretee") ||
      this.containsSubstring(lower, "arreter") ||
      this.containsSubstring(lower, "arretez") ||
      this.containsSubstring(lower, "arrête") ||
      this.containsSubstring(lower, "arrêtée") ||
      this.containsSubstring(lower, "arrêtez");

    return ((hasPresenteFacture || hasFactureActuelle) && (hasSomme || hasArreteVerb || hasMontantTotal)) || (this.containsSubstring(lower, "facture") && hasArreteVerb && hasMontantTotal);
  }

  findInvoicePresenceText(classifiedLines) {
    const lines = classifiedLines || [];

    for (let i = 0; i < lines.length; i++) {
      const lineInfo = lines[i];
      const cleaned = lineInfo && lineInfo.cleaned ? lineInfo.cleaned : "";
      if (cleaned && this.hasInvoicePresencePhrase(cleaned)) {
        const lower = this.toLowerCaseSafe(cleaned);
        const phraseValue = this.extractInvoicePresenceValue(cleaned);
        if (phraseValue) {
          return phraseValue;
        }

        const nearbyValue = this.findInvoicePresenceValueNearby(lines, i);
        if (nearbyValue) {
          return nearbyValue;
        }
      }
    }

    return "";
  }

  findInvoicePresenceValueNearby(lines, startIndex) {
    const fragments = [];
    let bestSingle = "";

    for (let i = startIndex + 1; i <= Math.min(lines.length - 1, startIndex + 4); i++) {
      const nextLine = lines[i] && lines[i].cleaned ? lines[i].cleaned : "";
      const nextLower = this.toLowerCaseSafe(nextLine);
      if (!nextLine) continue;

      const looksLikeWrittenAmount =
        this.containsFrenchNumberWords(nextLower) ||
        this.containsSubstring(nextLower, "dirham") ||
        this.containsSubstring(nextLower, "dhs");

      if (!looksLikeWrittenAmount) {
        if (fragments.length > 0) break;
        continue;
      }

      fragments.push(this.cleanInvoicePresenceValue(nextLine));

      const joined = this.cleanInvoicePresenceValue(fragments.join(" "));
      if (joined &&
          (this.containsFrenchNumberWords(this.toLowerCaseSafe(joined)) ||
           this.containsSubstring(this.toLowerCaseSafe(joined), "dirham") ||
           this.containsSubstring(this.toLowerCaseSafe(joined), "dhs"))) {
        const parsed = this.parseInvoicePresenceAmount(joined);
        if (parsed > 0 && fragments.length > 1) {
          return joined;
        }
      }

      if (fragments.length === 1 && !bestSingle) {
        const single = fragments[0];
        const parsedSingle = this.parseInvoicePresenceAmount(single);
        if (parsedSingle > 0) {
          bestSingle = single;
        }
      }
    }

    return bestSingle;
  }

  extractInvoicePresenceValue(text) {
    const original = this.trimSafe(text || "");
    if (!original) return "";

    const lower = this.toLowerCaseSafe(original);
    const markers = [
      "a la somme de",
      "à la somme de",
      "somme de",
      ":"
    ];

    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const index = lower.indexOf(this.toLowerCaseSafe(marker));
      if (index === -1) continue;

      const extracted = this.cleanInvoicePresenceValue(original.slice(index + marker.length));
      if (extracted && (this.containsFrenchNumberWords(extracted) ||
          this.containsSubstring(this.toLowerCaseSafe(extracted), "dirham") ||
          this.containsSubstring(this.toLowerCaseSafe(extracted), "dhs"))) {
        return extracted;
      }
    }

    return "";
  }

  cleanInvoicePresenceValue(text) {
    let value = this.trimSafe(text || "");
    while (value.length > 0) {
      const first = value[0];
      if (first === ":" || first === "-" || first === " " || first === ".") {
        value = this.trimSafe(value.slice(1));
        continue;
      }
      break;
    }

    while (value.length > 0) {
      const last = value[value.length - 1];
      if (last === "." || last === ":" || last === ";" || last === ",") {
        value = this.trimSafe(value.slice(0, -1));
        continue;
      }
      break;
    }

    return value;
  }

  parseInvoicePresenceAmount(text) {
    const valueText = this.trimSafe(text || "");
    if (!valueText) return 0;

    const parsed = this.parseFrenchAmountWords(valueText);
    return parsed !== null && parsed > 0 ? parsed : 0;
  }

  applyInvoicePresenceTtcConfirmation(result) {
    if (!result) return;

    const writtenAmount = typeof result.invoicePresenceAmount === "number" ? result.invoicePresenceAmount : 0;
    if (!writtenAmount || writtenAmount <= 0) return;

    if (!result.validationNotes) {
      result.validationNotes = [];
    }

    if (!result.montantTtc || result.montantTtc <= 0) {
      result.montantTtc = writtenAmount;
      result.confidence.montantTtc = Math.max(result.confidence.montantTtc || 0, 96);
      result.validationNotes.push("Set TTC from invoice presence text");
      return;
    }

    const diff = Math.abs(result.montantTtc - writtenAmount);
    const tolerance = Math.max(1, writtenAmount * 0.01);

    if (diff <= tolerance) {
      result.confidence.montantTtc = Math.max(result.confidence.montantTtc || 0, 97);
      result.validationNotes.push(
        diff <= 0.01
          ? "Invoice presence text confirms TTC"
          : "Invoice presence text roughly matches TTC"
      );
      return;
    }

    const hasValidatedNumericTriplet =
      typeof result.montantHt === "number" &&
      result.montantHt > 0 &&
      typeof result.tva === "number" &&
      result.tva >= 0 &&
      typeof result.montantTtc === "number" &&
      result.montantTtc > 0;

    if (hasValidatedNumericTriplet) {
      const expectedTtc = Math.round((result.montantHt + result.tva) * 100) / 100;
      const numericTolerance = Math.max(1, result.montantTtc * 0.02);
      const tripletLooksConsistent = Math.abs(expectedTtc - result.montantTtc) <= numericTolerance;
      const writtenLooksImplausible =
        writtenAmount < result.montantHt ||
        writtenAmount < result.tva ||
        Math.abs(expectedTtc - writtenAmount) > numericTolerance;

      if (tripletLooksConsistent && writtenLooksImplausible) {
        result.validationNotes.push("Ignored invoice presence text because validated numeric TTC looked more reliable");
        return;
      }
    }

    result.montantTtc = writtenAmount;
    result.confidence.montantTtc = Math.max(result.confidence.montantTtc || 0, 96);
    result.validationNotes.push("Replaced OCR TTC with invoice presence text amount");
  }

  containsSubstring(str, substr) {
    if (!str || !substr) return false;
    
    const lowerStr = this.toLowerCaseSafe(str);
    const lowerSubstr = this.toLowerCaseSafe(substr);
    
    for (let i = 0; i <= lowerStr.length - lowerSubstr.length; i++) {
      let match = true;
      for (let j = 0; j < lowerSubstr.length; j++) {
        if (lowerStr[i + j] !== lowerSubstr[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    
    return false;
  }

  containsAnyKeyword(str, keywords) {
    for (let i = 0; i < keywords.length; i++) {
      if (this.containsSubstring(str, keywords[i])) {
        return true;
      }
    }
    return false;
  }

  toLowerCaseSafe(str) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        result += String.fromCharCode(code + 32);
      } else {
        result += str[i];
      }
    }
    return result;
  }

  looksLikeReference(token) {
    // References are typically alphanumeric with some separators
    // Examples: F2022512-14057, C202PV2512-0037, 12345-A
    
    if (token.length < 3 || token.length > 30) return false;
    
    let hasLetter = false;
    let hasDigit = false;
    let hasSeparator = false;
    
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        hasLetter = true;
      } else if (code >= 48 && code <= 57) {
        hasDigit = true;
      } else if (code === 45 || code === 95 || code === 47) { // - _ /
        hasSeparator = true;
      }
    }
    
    // Good references have both letters and digits
    return (hasLetter && hasDigit) || (hasDigit && hasSeparator);
  }

  looksLikeDate(token) {
    // Check for date patterns: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    if (this.parseFrenchMonthNamedDateToken(token)) return true;
    
    let separatorCount = 0;
    let digitCount = 0;
    let separator = null;
    
    for (let i = 0; i < token.length; i++) {
      const char = token[i];
      const code = char.charCodeAt(0);
      
      if (code >= 48 && code <= 57) {
        digitCount++;
      } else if (char === '/' || char === '-' || char === '.') {
        separatorCount++;
        separator = char;
      } else {
        return false; // Invalid character
      }
    }
    
    // Valid date has 2 separators and 6-8 digits
    return separatorCount === 2 && digitCount >= 6 && digitCount <= 8;
  }

  extractDateTokensFromText(text) {
    const matches = [];
    const seen = {};
    const source = String(text || "");

    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      const code = char.charCodeAt(0);
      if (code < 48 || code > 57) continue;

      let candidate = "";
      let separatorCount = 0;
      let digitCount = 0;

      for (let j = i; j < source.length; j++) {
        const next = source[j];
        const nextCode = next.charCodeAt(0);

        if (nextCode >= 48 && nextCode <= 57) {
          candidate += next;
          digitCount++;
          continue;
        }

        if (next === "/" || next === "-" || next === ".") {
          candidate += next;
          separatorCount++;
          if (separatorCount > 2) break;
          continue;
        }

        break;
      }

      if (separatorCount === 2 && digitCount >= 6 && digitCount <= 8 && this.looksLikeDate(candidate)) {
        if (!seen[candidate]) {
          seen[candidate] = true;
          matches.push(candidate);
        }
      }
    }

    return matches;
  }

  extractFrenchMonthDateTokensFromText(text) {
    const source = String(text || "");
    const compact = this.normalizeComparableText(source);
    const matches = [];
    const seen = {};
    const monthPatterns = [
      "janv", "janvier",
      "fevr", "fevrier", "fevrier",
      "mars",
      "avr", "avril",
      "mai",
      "juin",
      "juil", "juillet",
      "aout", "août",
      "sept", "septembre",
      "oct", "octobre",
      "nov", "novembre",
      "dec", "decembre", "décembre"
    ];

    for (let i = 0; i < compact.length; i++) {
      const first = compact.charCodeAt(i);
      if (first < 48 || first > 57) continue;

      for (let dayLen = 1; dayLen <= 2; dayLen++) {
        if (i + dayLen >= compact.length) continue;
        const dayPart = compact.slice(i, i + dayLen);
        if (!this.looksLikePureNumber(dayPart)) continue;

        for (let m = 0; m < monthPatterns.length; m++) {
          const monthPattern = monthPatterns[m];
          const monthStart = i + dayLen;
          const monthEnd = monthStart + monthPattern.length;
          if (monthEnd + 4 > compact.length) continue;
          if (compact.slice(monthStart, monthEnd) !== monthPattern) continue;

          const yearPart = compact.slice(monthEnd, monthEnd + 4);
          if (!this.looksLikePureNumber(yearPart)) continue;

          const candidate = dayPart + monthPattern + yearPart;
          if (seen[candidate]) continue;
          if (this.parseFrenchMonthNamedDateToken(candidate)) {
            seen[candidate] = true;
            matches.push(candidate);
          }
        }
      }
    }

    return matches;
  }

  parseDate(token) {
    const namedDate = this.parseFrenchMonthNamedDateToken(token);
    if (namedDate) return namedDate;

    // Parse date token into components
    let separator = null;
    
    for (let i = 0; i < token.length; i++) {
      const char = token[i];
      if (char === '/' || char === '-' || char === '.') {
        separator = char;
        break;
      }
    }
    
    if (!separator) return { valid: false };
    
    // Split by separator
    const parts = this.splitByChar(token, separator);
    
    if (parts.length !== 3) return { valid: false };
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    // Validate ranges
    if (isNaN(day) || isNaN(month) || isNaN(year)) return { valid: false };
    if (parts[2].length === 2) {
      year = year >= 70 ? (1900 + year) : (2000 + year);
    }
    if (day < 1 || day > 31) return { valid: false };
    if (month < 1 || month > 12) return { valid: false };
    if (year < 1990 || year > 2030) return { valid: false };
    
    return {
      valid: true,
      day,
      month,
      year,
      original: token
    };
  }

  parseFrenchMonthNamedDateToken(token) {
    const compact = this.normalizeComparableText(token || "");
    if (!compact || compact.length < 7) return null;

    let dayLength = 0;
    for (let i = 0; i < compact.length && i < 2; i++) {
      const code = compact.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        dayLength++;
      } else {
        break;
      }
    }

    if (dayLength < 1 || dayLength > 2) return null;

    const yearPart = compact.slice(compact.length - 4);
    if (!this.looksLikePureNumber(yearPart)) return null;

    const monthPart = compact.slice(dayLength, compact.length - 4);
    const month = this.parseFrenchMonthName(monthPart);
    if (month === null) return null;

    const day = parseInt(compact.slice(0, dayLength), 10);
    const year = parseInt(yearPart, 10);
    if (isNaN(day) || isNaN(year)) return null;
    if (day < 1 || day > 31) return null;
    if (year < 1990 || year > 2030) return null;

    return {
      valid: true,
      day,
      month,
      year,
      original: token
    };
  }

  parseFrenchMonthName(value) {
    const monthToken = this.normalizeComparableText(value || "");
    const monthMap = {
      janv: 1,
      janvier: 1,
      fevr: 2,
      fevrier: 2,
      mars: 3,
      avr: 4,
      avril: 4,
      mai: 5,
      juin: 6,
      juil: 7,
      juillet: 7,
      aout: 8,
      sept: 9,
      septembre: 9,
      oct: 10,
      octobre: 10,
      nov: 11,
      novembre: 11,
      dec: 12,
      decembre: 12
    };

    return monthMap.hasOwnProperty(monthToken) ? monthMap[monthToken] : null;
  }

  extractInvoiceReferenceFromText(text) {
    const source = String(text || "");
    if (!source) return "";

    const lower = this.toLowerCaseSafe(source);
    const factureIndex = lower.indexOf("facture");
    if (factureIndex === -1) return "";

    let start = factureIndex + 7;

    while (start < source.length) {
      const char = source[start];
      const lowerChar = this.toLowerCaseSafe(char);
      const code = char.charCodeAt(0);
      const isDigit = code >= 48 && code <= 57;
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

      if (char === ' ' || char === ':' || char === '.' || char === '°') {
        start++;
        continue;
      }

      if (lowerChar === 'n' || lowerChar === 'o') {
        start++;
        continue;
      }

      if (isDigit || isLetter) {
        break;
      }

      start++;
    }

    let candidate = "";
    for (let i = start; i < source.length; i++) {
      const char = source[i];
      const code = char.charCodeAt(0);
      const isDigit = code >= 48 && code <= 57;
      const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
      const isSeparator = char === '/' || char === '-' || char === '_';

      if (isDigit || isLetter || isSeparator) {
        candidate += char;
        continue;
      }

      break;
    }

    candidate = this.normalizeReferenceToken(candidate);
    if (!candidate) return "";
    if (this.looksLikeDate(candidate)) return "";
    if (!this.looksLikeReference(candidate)) return "";

    return candidate;
  }

  splitByChar(str, separator) {
    const parts = [];
    let current = "";
    
    for (let i = 0; i < str.length; i++) {
      if (str[i] === separator) {
        parts.push(current);
        current = "";
      } else {
        current += str[i];
      }
    }
    parts.push(current);
    
    return parts;
  }

  isLikelyInvoiceReference(token, context) {
    if (!token || token.length < 4 || token.length > 30) return false;
    const lowerToken = this.toLowerCaseSafe(token);
    const lowerContext = this.toLowerCaseSafe(context || "");

    if (this.containsSubstring(lowerToken, "facture") || this.containsSubstring(lowerToken, "invoice")) {
      return false;
    }

    let digitCount = 0;
    let letterCount = 0;
    let separatorCount = 0;
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      if (code >= 48 && code <= 57) digitCount++;
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) letterCount++;
      else if (token[i] === '-' || token[i] === '/' || token[i] === '_') separatorCount++;
    }

    if (digitCount < 2) return false;

    const anchoredByInvoiceWord =
      this.containsSubstring(lowerContext, "facture") ||
      this.containsSubstring(lowerContext, "invoice") ||
      this.containsSubstring(lowerContext, "bl/facture") ||
      this.containsSubstring(lowerContext, "n°") ||
      this.containsSubstring(lowerContext, "nÂ°") ||
      this.containsSubstring(lowerContext, "numero");

    if (!this.looksLikeReference(token) &&
        !(anchoredByInvoiceWord && this.looksLikePureNumber(token) && token.length >= 6)) {
      return false;
    }

    if (anchoredByInvoiceWord) {
      return true;
    }

    if (separatorCount > 0 && digitCount >= 3) {
      return true;
    }

    if (letterCount >= 2 && digitCount >= 3) {
      return true;
    }

    return false;
  }

  isInvoiceReferenceContext(context) {
    const lower = this.toLowerCaseSafe(context || "");
    return this.containsSubstring(lower, "facture") ||
      this.containsSubstring(lower, "invoice") ||
      this.containsSubstring(lower, "bl/facture") ||
      this.containsSubstring(lower, "facture n") ||
      this.containsSubstring(lower, "n° de la facture") ||
      this.containsSubstring(lower, "numero") ||
      this.containsSubstring(lower, "numéro") ||
      this.containsSubstring(lower, "num");
  }

  isInvoiceMarkerToken(token) {
    const lower = this.toLowerCaseSafe(token || "");
    return lower === "n" || lower === "n°" || lower === "nâ°" || lower === "no" || lower === "n:";
  }

  normalizeReferenceToken(token) {
    if (!token) return "";

    let start = 0;
    let end = token.length - 1;

    while (start <= end) {
      const char = token[start];
      if (char === ':' || char === '.' || char === ',' || char === '|' || char === '(' || char === ')' || char === '#') {
        start++;
      } else {
        break;
      }
    }

    while (end >= start) {
      const char = token[end];
      if (char === ':' || char === '.' || char === ',' || char === '|' || char === '(' || char === ')' || char === '#') {
        end--;
      } else {
        break;
      }
    }

    let normalized = "";
    for (let i = start; i <= end; i++) {
      normalized += token[i];
    }

    const lower = this.toLowerCaseSafe(normalized);
    if (lower === "n" || lower === "n°" || lower === "nÂ°" || lower === "num" || lower === "numero") {
      return "";
    }

    return normalized;
  }

  looksLikeMoney(token) {
    // Money values have digits and optionally one decimal separator
    // Examples: 1596,10  1596.10  1,596.10  €1596
    // NOT: 1251100578 (too many digits without decimal)
    // NOT: 20% (percentage/rate, not an amount)

    let digitCount = 0;
    let separatorCount = 0;
    let hasCurrency = false;
    let hasDecimal = false;
    let hasPercent = false;

    for (let i = 0; i < token.length; i++) {
      const char = token[i];
      const code = char.charCodeAt(0);

      if (code >= 48 && code <= 57) {
        digitCount++;
      } else if (char === ',' || char === '.') {
        separatorCount++;
        hasDecimal = true;
      } else if (code === 8364 || code === 36 || code === 163) { // € $ £
        hasCurrency = true;
      } else if (code === 37) { // % percent sign
        hasPercent = true;
      } else if (code === 58) { // : colon - skip but don't reject
        continue;
      } else {
        return false;
      }
    }

    // Reject percentages (these are rates, not amounts)
    if (hasPercent) return false;

    // Valid money has:
    // - At least 2 digits
    // - At most 2 separators
    // - If more than 5 digits, must have decimal separator (to exclude IDs)
    if (digitCount < 2 || separatorCount > 2) return false;
    if (digitCount > 5 && !hasDecimal) return false;

    return true;
  }

  parseMoneyValue(token) {
    // Parse money token into numeric value
    let normalized = "";
    let separatorCount = 0;
    
    for (let i = 0; i < token.length; i++) {
      const char = token[i];
      const code = char.charCodeAt(0);
      
      if (code >= 48 && code <= 57) {
        normalized += char;
      } else if (char === ',' || char === '.') {
        normalized += '.'; // Normalize to dot
        separatorCount++;
      }
      // Skip currency symbols
    }
    
    if (normalized.length === 0) return null;
    
    // Handle multiple separators (keep only last as decimal)
    if (separatorCount > 1) {
      // Remove all but last separator
      let lastSepIndex = -1;
      for (let i = normalized.length - 1; i >= 0; i--) {
        if (normalized[i] === '.') {
          lastSepIndex = i;
          break;
        }
      }
      
      let result = "";
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] === '.' && i !== lastSepIndex) {
          continue; // Skip this separator
        }
        result += normalized[i];
      }
      normalized = result;
    }
    
    const value = parseFloat(normalized);
    
    if (isNaN(value)) return null;
    
    return Math.round(value * 100) / 100;
  }

  looksLikePhone(token) {
    // Phone numbers are typically 8-15 digits
    let digitCount = 0;
    
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        digitCount++;
      } else if (code !== 43 && code !== 45 && code !== 32) { // + - space
        return false;
      }
    }
    
    return digitCount >= 8 && digitCount <= 15;
  }

  containsPhonePattern(str) {
    // Check if string contains phone-like patterns
    const tokens = this.tokenize(str);
    
    for (let i = 0; i < tokens.length; i++) {
      if (this.looksLikePhone(tokens[i])) {
        return true;
      }
    }
    
    return false;
  }

  containsEmailPattern(str) {
    if (!str) return false;

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '@') return true;
    }

    const lower = this.toLowerCaseSafe(str);
    return this.containsSubstring(lower, "gmail") ||
      this.containsSubstring(lower, "email") ||
      this.containsSubstring(lower, "www.") ||
      this.containsSubstring(lower, ".com") ||
      this.containsSubstring(lower, ".ma");
  }

  looksLikePureNumber(token) {
    // Check if token is purely numeric (no letters)
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      if (code < 48 || code > 57) {
        return false;
      }
    }
    return token.length > 0;
  }

  looksLikeAddressFragment(text) {
    const lower = this.toLowerCaseSafe(text || "");
    const hasAddressToken =
      this.containsSubstring(lower, "appt") ||
      this.containsSubstring(lower, "imm") ||
      this.containsSubstring(lower, "lot") ||
      this.containsSubstring(lower, "av ") ||
      this.containsSubstring(lower, "allal") ||
      this.containsSubstring(lower, "marrakech") ||
      this.containsSubstring(lower, "casablanca") ||
      this.containsSubstring(lower, "maroc") ||
      this.containsSubstring(lower, "rue") ||
      this.containsSubstring(lower, "avenue") ||
      this.containsSubstring(lower, "route");

    if (!hasAddressToken) return false;
    return this.countDigits(text || "") > 0 || this.tokenize(text || "").length >= 2;
  }

  looksLikeProductCode(token) {
    // Product codes often have patterns like: 8X17X20, PV-8-IFRN
    if (token.length < 4 || token.length > 20) return false;
    
    let hasLetter = false;
    let hasDigit = false;
    let hasX = false;
    
    for (let i = 0; i < token.length; i++) {
      const char = token[i];
      const code = char.charCodeAt(0);
      
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        hasLetter = true;
        if (char === 'X' || char === 'x') hasX = true;
      } else if (code >= 48 && code <= 57) {
        hasDigit = true;
      }
    }
    
    return hasLetter && hasDigit && hasX;
  }

  containsCurrencySymbol(token) {
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      if (code === 8364 || code === 36 || code === 163) { // € $ £
        return true;
      }
    }
    return false;
  }

  getZoneForLine(lineIndex, zones) {
    if (lineIndex <= zones.header.end) return "header";
    if (lineIndex <= zones.body.end) return "body";
    return "footer";
  }
}

// =========================================================================
// INTELLIGENT DECISION-MAKING SYSTEM
// =========================================================================

/**
 * Decision thresholds for each field
 * Defines confidence levels for accept/review/reject decisions
 */
const DECISION_THRESHOLDS = {
  numeroFacture: { accept: 70, review: 50, reject: 30 },
  fournisseur: { accept: 65, review: 45, reject: 25 },
  ice: { accept: 75, review: 55, reject: 35 },
  dateFacture: { accept: 70, review: 50, reject: 30 },
  montantHt: { accept: 75, review: 55, reject: 35 },
  tva: { accept: 75, review: 55, reject: 35 },
  montantTtc: { accept: 80, review: 60, reject: 40 } // Money needs higher confidence
};

/**
 * Document type patterns for context-aware extraction
 */
const DOCUMENT_PATTERNS = {
  electricity: ['electricit', 'edf', 'consommation', 'compteur', 'kwh'],
  telecom: ['telecom', 'forfait', 'communication', 'orange', 'maroc telecom'],
  water: ['eau', 'water', 'lydec', 'redal', 'amendis'],
  standard: ['facture', 'invoice', 'fournisseur', 'client']
};

/**
 * Context Reasoner - Analyzes document context to inform extraction decisions
 */
class ContextReasoner {
  analyzeDocument(lines, zones) {
    return {
      documentType: this.detectDocumentType(lines),
      layoutStyle: this.detectLayoutStyle(zones),
      qualityScore: this.assessOCRQuality(lines),
      hasStructuredTotals: this.detectStructuredTotals(lines),
      isMultiPage: this.detectMultiPage(lines),
      language: this.detectLanguage(lines),
      currency: this.detectCurrency(lines),
      hasTriplet: this.detectTripletPattern(lines),
      hasWrittenTotal: this.detectWrittenTotal(lines)
    };
  }

  detectDocumentType(lines) {
    const allText = lines.map(l => l.cleaned || l).join(' ').toLowerCase();

    const scores = {};
    for (const type of Object.keys(DOCUMENT_PATTERNS)) {
      scores[type] = 0;
    }

    for (const [type, patterns] of Object.entries(DOCUMENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (!allText.includes(pattern)) continue;
        scores[type] += 1;
        if (type === "telecom" && (pattern === "maroc telecom" || pattern === "orange" || pattern === "telecom")) {
          scores[type] += 2;
        }
      }
    }

    if ((scores.telecom || 0) >= 3) {
      return "telecom";
    }
    if ((scores.electricity || 0) >= 1 && (scores.standard || 0) === 0) {
      return "electricity";
    }
    if ((scores.water || 0) >= 1 && (scores.standard || 0) === 0) {
      return "water";
    }
    if ((scores.standard || 0) > 0) {
      return "standard";
    }

    let bestType = "standard";
    let bestScore = 0;
    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestType = type;
        bestScore = score;
      }
    }

    return bestType;
  }

  detectLayoutStyle(zones) {
    const headerRatio = zones.header.lines.length / Math.max(1, 
      zones.header.lines.length + zones.body.lines.length + zones.footer.lines.length);
    
    if (headerRatio > 0.4) return 'header-heavy';
    if (zones.footer.lines.length > zones.header.lines.length) return 'footer-heavy';
    return 'balanced';
  }

  assessOCRQuality(lines) {
    if (lines.length === 0) return 0;
    
    let qualityScore = 100;
    let lowTrustCount = 0;
    
    for (const line of lines) {
      if (line.lowTrust) lowTrustCount++;
      if (line.trustScore < 50) qualityScore -= 5;
    }
    
    const lowTrustRatio = lowTrustCount / lines.length;
    qualityScore -= lowTrustRatio * 30;
    
    return Math.max(0, Math.min(100, qualityScore));
  }

  detectStructuredTotals(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i].cleaned || lines[i]).toLowerCase();
      if (line.includes('total ht') && line.includes('tva') && line.includes('ttc')) {
        return true;
      }
    }
    return false;
  }

  detectMultiPage(lines) {
    for (const line of lines) {
      const text = (line.cleaned || line).toLowerCase();
      if (text.includes('page') && (text.includes('sur') || text.includes('de') || text.includes('/'))) {
        return true;
      }
    }
    return false;
  }

  detectLanguage(lines) {
    const allText = lines.map(l => l.cleaned || l).join(' ').toLowerCase();
    
    const frenchPatterns = ['le', 'la', 'les', 'de', 'des', 'facture', 'montant', 'société'];
    const englishPatterns = ['the', 'and', 'invoice', 'amount', 'company', 'total'];
    
    let frenchScore = 0;
    let englishScore = 0;
    
    for (const pattern of frenchPatterns) {
      if (allText.includes(pattern)) frenchScore++;
    }
    for (const pattern of englishPatterns) {
      if (allText.includes(pattern)) englishScore++;
    }
    
    return frenchScore >= englishScore ? 'french' : 'english';
  }

  detectCurrency(lines) {
    const allText = lines.map(l => l.cleaned || l).join(' ');
    
    if (allText.includes('€') || allText.includes('EUR')) return 'EUR';
    if (allText.includes('DH') || allText.includes('MAD') || allText.includes('Dirham')) return 'MAD';
    if (allText.includes('$') || allText.includes('USD')) return 'USD';
    if (allText.includes('£') || allText.includes('GBP')) return 'GBP';
    
    return 'unknown';
  }

  detectTripletPattern(lines) {
    // Look for lines with 3 money values that could be HT/TVA/TTC
    for (const line of lines) {
      const tokens = (line.tokens || []);
      let moneyCount = 0;
      
      for (const token of tokens) {
        if (/^\d+[,.]\d{2}$/.test(token)) {
          moneyCount++;
        }
      }
      
      if (moneyCount >= 3) return true;
    }
    return false;
  }

  detectWrittenTotal(lines) {
    const frenchNumberWords = ['mille', 'cent', 'million', 'deux', 'trois', 'quatre', 'cinq', 
                               'six', 'sept', 'huit', 'neuf', 'dix', 'vingt', 'trente'];
    
    for (const line of lines) {
      const text = (line.cleaned || line).toLowerCase();
      if (text.includes('arrêté') || text.includes('arrête') || text.includes('somme de')) {
        for (const word of frenchNumberWords) {
          if (text.includes(word)) return true;
        }
      }
    }
    return false;
  }

  getExtractionStrategy(context) {
    const strategy = {
      priorityFields: [],
      confidenceAdjustments: {},
      searchPatterns: []
    };

    // Adjust strategy based on document type
    if (context.documentType === 'electricity') {
      strategy.priorityFields = ['montantTtc', 'dateFacture', 'numeroFacture'];
      strategy.searchPatterns = ['montant a payer', 'total facture', 'echeance'];
      strategy.confidenceAdjustments.montantTtc = 10; // Boost confidence for structured bills
    }

    if (context.documentType === 'telecom') {
      strategy.priorityFields = ['montantTtc', 'numeroFacture'];
      strategy.searchPatterns = ['total ttc', 'net a payer', 'facture n'];
    }

    // Adjust for OCR quality
    if (context.qualityScore < 50) {
      // Low quality - be more conservative
      for (const field of Object.keys(DECISION_THRESHOLDS)) {
        strategy.confidenceAdjustments[field] = -15;
      }
    } else if (context.qualityScore > 80) {
      // High quality - can be more confident
      for (const field of Object.keys(DECISION_THRESHOLDS)) {
        strategy.confidenceAdjustments[field] = 5;
      }
    }

    // Multi-page documents need special handling
    if (context.isMultiPage) {
      strategy.searchPatterns.push('page 1', 'page 1 sur');
    }

    return strategy;
  }
}

/**
 * Decision Engine - Makes intelligent decisions about candidate selection
 */
class DecisionEngine {
  constructor() {
    this.contextReasoner = new ContextReasoner();
    this.decisionHistory = [];
  }

  /**
   * Make a decision for a specific field
   * @param {string} field - Field name (e.g., 'fournisseur', 'montantTtc')
   * @param {Array} candidates - List of candidate values with scores
   * @param {Object} context - Document context from ContextReasoner
   * @returns {Object} Decision with action, value, and reasoning
   */
  decide(field, candidates, context) {
    const threshold = DECISION_THRESHOLDS[field];
    if (!threshold) {
      return { action: 'unknown', value: null, reason: 'unknown field' };
    }

    if (!candidates || candidates.length === 0) {
      return { action: 'reject', value: null, reason: 'no candidates', confidence: 0 };
    }

    // Get top candidate
    const topCandidate = candidates[0];
    let confidence = topCandidate.score || topCandidate.confidence || 50;

    // Apply context-based adjustments
    const strategy = this.contextReasoner.getExtractionStrategy(context);
    if (strategy.confidenceAdjustments[field]) {
      confidence += strategy.confidenceAdjustments[field];
    }

    // Apply decision rules
    const decision = this.applyDecisionRules(field, topCandidate, candidates, context, confidence, threshold);

    // Record decision for learning
    this.decisionHistory.push({
      field,
      decision: decision.action,
      confidence,
      timestamp: Date.now()
    });

    return decision;
  }

  applyDecisionRules(field, candidate, allCandidates, context, confidence, threshold) {
    const decision = {
      action: 'accept',
      value: candidate.value,
      confidence: Math.max(0, Math.min(100, confidence)),
      reasons: []
    };

    // Rule 1: Check confidence threshold
    if (confidence >= threshold.accept) {
      decision.reasons.push('high-confidence');
    } else if (confidence >= threshold.review) {
      decision.action = 'review';
      decision.reasons.push('medium-confidence-needs-review');
    } else if (confidence >= threshold.reject) {
      decision.action = 'review';
      decision.reasons.push('low-confidence-flagged');
    } else {
      decision.action = 'reject';
      decision.reasons.push('very-low-confidence');
      decision.value = null;
    }

    // Rule 2: Check for conflicting candidates
    if (allCandidates.length > 1) {
      const secondCandidate = allCandidates[1];
      const scoreGap = confidence - (secondCandidate.score || 50);
      
      if (scoreGap < 10) {
        decision.reasons.push('close-competing-candidates');
        if (decision.action === 'accept') {
          decision.action = 'review';
        }
      }
    }

    // Rule 3: Field-specific rules
    if (field === 'montantTtc') {
      // Money fields need consistency check
      if (context.hasTriplet && confidence < 70) {
        decision.reasons.push('triplet-available-but-low-confidence');
      }
    }

    if (field === 'fournisseur') {
      // Supplier should have minimum length
      if (candidate.value && candidate.value.length < 5) {
        decision.action = 'reject';
        decision.reasons.push('supplier-too-short');
        decision.value = null;
      }
    }

    if (field === 'dateFacture') {
      // Date should be parseable
      if (candidate.parsed && !candidate.parsed.valid) {
        decision.confidence -= 20;
        decision.reasons.push('date-parse-warning');
      }
    }

    // Rule 4: Context-based rules
    if (context.qualityScore < 40 && decision.action === 'accept') {
      decision.action = 'review';
      decision.reasons.push('low-ocr-quality-caution');
    }

    return decision;
  }

  /**
   * Make a global decision across all fields
   */
  makeGlobalDecision(fieldDecisions, context) {
    const result = {
      overallAction: 'accept',
      requiresReview: false,
      missingFields: [],
      lowConfidenceFields: [],
      recommendations: []
    };

    for (const [field, decision] of Object.entries(fieldDecisions)) {
      if (!decision.value || decision.value === '' || decision.value === 0) {
        result.missingFields.push(field);
      }

      if (decision.confidence < DECISION_THRESHOLDS[field].review) {
        result.lowConfidenceFields.push(field);
      }

      if (decision.action === 'review') {
        result.requiresReview = true;
      }

      if (decision.action === 'reject') {
        result.overallAction = 'review';
      }
    }

    // Generate recommendations
    if (result.missingFields.length > 0) {
      result.recommendations.push(`Missing fields: ${result.missingFields.join(', ')}. Manual review recommended.`);
    }

    if (result.lowConfidenceFields.length > 0) {
      result.recommendations.push(`Low confidence fields: ${result.lowConfidenceFields.join(', ')}. Verify extraction.`);
    }

    if (context.qualityScore < 50) {
      result.recommendations.push('Low OCR quality detected. Consider re-scanning the document.');
    }

    if (context.isMultiPage) {
      result.recommendations.push('Multi-page document. Ensure all pages were processed.');
    }

    return result;
  }

  /**
   * Get decision statistics for analysis
   */
  getDecisionStats() {
    const stats = {
      total: this.decisionHistory.length,
      byAction: { accept: 0, review: 0, reject: 0 },
      byField: {},
      avgConfidence: 0
    };

    let confidenceSum = 0;
    for (const record of this.decisionHistory) {
      stats.byAction[record.decision]++;
      
      if (!stats.byField[record.field]) {
        stats.byField[record.field] = { accept: 0, review: 0, reject: 0 };
      }
      stats.byField[record.field][record.decision]++;
      
      confidenceSum += record.confidence;
    }

    if (stats.total > 0) {
      stats.avgConfidence = Math.round(confidenceSum / stats.total);
    }

    return stats;
  }
}

/**
 * Learning System - Learns from user corrections to improve future extractions
 */
class LearningSystem {
  constructor(weightsPath = 'alpha.weights.json') {
    this.weightsPath = weightsPath;
    this.corrections = [];
    this.trainingData = [];
  }

  /**
   * Record a user correction
   */
  recordCorrection(field, predictedValue, correctedValue, context, features) {
    const correction = {
      field,
      predicted: predictedValue,
      corrected: correctedValue,
      context: {
        documentType: context.documentType,
        qualityScore: context.qualityScore,
        originalConfidence: context.confidence
      },
      features: features || {},
      timestamp: Date.now()
    };

    this.corrections.push(correction);
    this.trainingData.push(this.correctionToTrainingExample(correction));

    // Auto-save after enough corrections
    if (this.corrections.length >= 10) {
      this.analyzeCorrections();
    }

    return correction;
  }

  correctionToTrainingExample(correction) {
    return {
      features: correction.features,
      label: this.valuesMatch(correction.predicted, correction.corrected) ? 1 : 0,
      field: correction.field
    };
  }

  valuesMatch(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.01;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase().trim() === b.toLowerCase().trim();
    }
    return false;
  }

  /**
   * Analyze corrections to identify patterns
   */
  analyzeCorrections() {
    const analysis = {
      totalCorrections: this.corrections.length,
      byField: {},
      commonMistakes: [],
      suggestedWeightAdjustments: {}
    };

    // Group by field
    for (const correction of this.corrections) {
      if (!analysis.byField[correction.field]) {
        analysis.byField[correction.field] = { total: 0, corrected: 0 };
      }
      analysis.byField[correction.field].total++;
      
      if (!this.valuesMatch(correction.predicted, correction.corrected)) {
        analysis.byField[correction.field].corrected++;
      }
    }

    // Identify common mistakes
    for (const [field, stats] of Object.entries(analysis.byField)) {
      const errorRate = stats.corrected / stats.total;
      if (errorRate > 0.3) {
        analysis.commonMistakes.push({
          field,
          errorRate: Math.round(errorRate * 100),
          suggestion: `Consider adjusting weights for ${field} extraction`
        });
      }
    }

    return analysis;
  }

  /**
   * Get suggested weight adjustments based on corrections
   */
  getSuggestedWeightAdjustments() {
    const adjustments = {};
    const analysis = this.analyzeCorrections();

    for (const mistake of analysis.commonMistakes) {
      adjustments[mistake.field] = {
        currentWeight: 1.0,
        suggestedWeight: 1.0 - (mistake.errorRate / 100) * 0.5,
        reason: `High error rate (${mistake.errorRate}%) in corrections`
      };
    }

    return adjustments;
  }

  /**
   * Export training data for external ML training
   */
  exportTrainingData(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.trainingData, null, 2);
    }
    
    // CSV format for spreadsheet analysis
    if (format === 'csv') {
      const headers = ['field', 'predicted', 'corrected', 'quality', 'confidence', 'timestamp'];
      const rows = this.corrections.map(c => [
        c.field,
        c.predicted,
        c.corrected,
        c.context.qualityScore,
        c.context.originalConfidence,
        c.timestamp
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return this.trainingData;
  }

  /**
   * Load corrections from file
   */
  loadCorrections(filePath) {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(filePath, 'utf8');
      this.corrections = JSON.parse(data);
      return true;
    } catch (error) {
      console.error('Failed to load corrections:', error);
      return false;
    }
  }

  /**
   * Save corrections to file
   */
  saveCorrections(filePath = null) {
    try {
      const fs = require('fs');
      const path = require('path');
      const savePath = filePath || path.join(__dirname, this.weightsPath.replace('.json', '_corrections.json'));
      
      fs.writeFileSync(savePath, JSON.stringify(this.corrections, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save corrections:', error);
      return false;
    }
  }
}

/**
 * Intelligent Invoice Extractor - Combines all decision-making capabilities
 */
class IntelligentInvoiceExtractor extends InvoiceExtractor {
  constructor(options = {}) {
    super(options);
    
    this.decisionEngine = new DecisionEngine();
    this.learningSystem = new LearningSystem(options.weightsPath);
    this.enableLearning = options.enableLearning !== false;
    this.lastContext = null;
    this.lastDecisions = null;
  }

  /**
   * Enhanced extract with intelligent decision-making
   */
  extract(text, options = {}) {
    // Step 1: Run base extraction
    const baseResult = super.extract(text, { ...options, includeFeatures: true });

    // Step 2: Analyze document context
    const preprocessed = this.preprocessText(text);
    const zones = this.detectZones(preprocessed.lines);
    const context = this.decisionEngine.contextReasoner.analyzeDocument(preprocessed.lines, zones);
    context.confidence = baseResult.confidence;
    this.lastContext = context;

    // Step 3: Make decisions for each field
    const fieldDecisions = {};
    const fields = ['numeroFacture', 'fournisseur', 'ice', 'dateFacture', 'montantHt', 'tva', 'montantTtc'];
    
    for (const field of fields) {
      const candidates = this.getCandidatesForField(field, baseResult.features);
      fieldDecisions[field] = this.decisionEngine.decide(field, candidates, context);
    }

    // Step 4: Make global decision
    const globalDecision = this.decisionEngine.makeGlobalDecision(fieldDecisions, context);

    this.applyAcceptedDecisions(baseResult, fieldDecisions);

    // Step 5: Enhance result with decision information
    const enhancedResult = {
      ...baseResult,
      decisions: fieldDecisions,
      globalDecision,
      context,
      learningEnabled: this.enableLearning
    };

    // Step 6: Apply confidence adjustments based on context
    this.applyContextAdjustments(enhancedResult, context);

    this.lastDecisions = fieldDecisions;

    return enhancedResult;
  }

  applyAcceptedDecisions(result, fieldDecisions) {
    if (!result || !fieldDecisions) return;

    const scalarFields = ["numeroFacture", "fournisseur", "dateFacture", "montantHt", "tva", "montantTtc"];
    for (let i = 0; i < scalarFields.length; i++) {
      const field = scalarFields[i];
      const decision = fieldDecisions[field];
      if (!decision || decision.action !== "accept") continue;
      if (decision.value === null || typeof decision.value === "undefined" || decision.value === "") continue;
      result[field] = decision.value;
      if (result.confidence && typeof decision.confidence === "number") {
        result.confidence[field] = Math.max(result.confidence[field] || 0, decision.confidence);
      }
    }
  }

  getCandidatesForField(field, features) {
    if (!features || !features.fields) return [];
    
    const fieldFeatures = features.fields[field];
    if (!fieldFeatures || !fieldFeatures.candidates) return [];

    return fieldFeatures.candidates.map(c => ({
      value: c.value,
      score: c.score,
      confidence: c.score,
      parsed: c.parsedAsDate ? { valid: c.parsedAsDate } : null
    }));
  }

  applyContextAdjustments(result, context) {
    const strategy = this.decisionEngine.contextReasoner.getExtractionStrategy(context);

    // Adjust confidence scores based on context
    for (const field of Object.keys(result.confidence)) {
      if (strategy.confidenceAdjustments[field]) {
        result.confidence[field] = Math.max(0, Math.min(100,
          result.confidence[field] + strategy.confidenceAdjustments[field]
        ));
      }
    }

    // Recalculate overall confidence
    result.confidence.overall = this.computeOverallConfidence(result);
  }

  /**
   * Submit a correction for learning
   */
  submitCorrection(field, correctedValue) {
    if (!this.enableLearning) {
      return { success: false, reason: 'learning disabled' };
    }

    const predictedValue = this.lastDecisions && this.lastDecisions[field] 
      ? this.lastDecisions[field].value 
      : null;

    const correction = this.learningSystem.recordCorrection(
      field,
      predictedValue,
      correctedValue,
      {
        documentType: this.lastContext ? this.lastContext.documentType : 'unknown',
        qualityScore: this.lastContext ? this.lastContext.qualityScore : 50,
        confidence: this.lastDecisions && this.lastDecisions[field] 
          ? this.lastDecisions[field].confidence 
          : 50
      },
      this.buildCorrectionFeatures(field)
    );

    return { success: true, correction };
  }

  buildCorrectionFeatures(field) {
    // Extract features that might be relevant for learning
    const features = {};
    
    if (this.lastContext) {
      features.documentType = this.lastContext.documentType;
      features.qualityScore = this.lastContext.qualityScore;
      features.hasTriplet = this.lastContext.hasTriplet;
      features.hasStructuredTotals = this.lastContext.hasStructuredTotals;
    }

    if (this.lastDecisions && this.lastDecisions[field]) {
      features.predictedConfidence = this.lastDecisions[field].confidence;
      features.reasons = this.lastDecisions[field].reasons;
    }

    return features;
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    return {
      corrections: this.learningSystem.corrections.length,
      analysis: this.learningSystem.analyzeCorrections(),
      suggestions: this.learningSystem.getSuggestedWeightAdjustments(),
      decisionStats: this.decisionEngine.getDecisionStats(),
      documentMemory: this.getDocumentMemoryStats()
    };
  }

  /**
   * Export all learning data
   */
  exportLearningData(format = 'json') {
    return this.learningSystem.exportTrainingData(format);
  }

  /**
   * Save corrections to file
   */
  saveLearningData(filePath = null) {
    return this.learningSystem.saveCorrections(filePath);
  }

  exportDocumentMemory() {
    return super.exportDocumentMemory();
  }

  setDocumentMemory(memory) {
    return super.setDocumentMemory(memory);
  }
}

// =========================================================================
// NEURAL NETWORK RERANKER (TensorFlow.js)
// =========================================================================

/**
 * Neural Network Reranker using TensorFlow.js
 * Provides better accuracy than linear model by learning non-linear patterns
 */
class NeuralReranker {
  constructor(inputSize = 30, fieldNames = []) {
    this.tf = null;
    this.inputSize = inputSize;
    this.fieldNames = fieldNames;
    this.models = {}; // One model per field
    this.featureNames = this.getFeatureNames();
    this.isLoaded = false;
  }

  /**
   * Get all feature names used by the neural network
   */
  getFeatureNames() {
    return [
      // Base features from candidate
      'heuristicScore', 'zoneHeader', 'zoneBody', 'zoneFooter',
      'hasInvoiceKeyword', 'hasSupplierKeyword', 'hasSupplierAnchor',
      'hasPhone', 'hasAdminKeyword', 'hasClientKeyword',
      'hasDateKeyword', 'hasTypeKeyword', 'hasTotalKeyword',
      'payableKeyword', 'looksLikeReference', 'hasDigits',
      'charLengthGood', 'goodLength', 'linePositionTop',
      'validDate', 'badDateContext', 'explicitType',
      'reasonableAmount', 'decimalAmount', 'likelyRate',
      // Context features
      'qualityScore', 'hasTriplet', 'hasStructuredTotals',
      // Document type features
      'docType_electricity', 'docType_telecom', 'docType_water'
    ];
  }

  /**
   * Load TensorFlow.js dynamically
   */
  async loadTensorFlow() {
    if (this.tf) return this.tf;

    const isNodeRuntime =
      typeof process !== 'undefined' &&
      process.versions &&
      !!process.versions.node;

    if (!isNodeRuntime) {
      console.warn('TensorFlow.js Node bindings are only available in Node.js runtime');
      return null;
    }

    try {
      // Hide the optional dependency from bundlers so browser builds don't fail.
      const dynamicRequire = typeof module !== 'undefined' && module.require
        ? module.require.bind(module)
        : Function('return require')();
      this.tf = dynamicRequire('@tensorflow/tfjs-node');
      console.log('TensorFlow.js loaded successfully');
      return this.tf;
    } catch (error) {
      console.warn('TensorFlow.js not available. Install with: npm install @tensorflow/tfjs-node');
      console.warn('Falling back to linear model');
      return null;
    }
  }

  /**
   * Build neural network model for a field
   */
  buildModel() {
    if (!this.tf) return null;

    const model = this.tf.sequential();

    // Input layer + Hidden layer 1
    model.add(this.tf.layers.dense({
      inputShape: [this.inputSize],
      units: 64,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: this.tf.regularizers.l2({ l2: 0.01 })
    }));

    model.add(this.tf.layers.dropout({ rate: 0.3 }));

    // Hidden layer 2
    model.add(this.tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: this.tf.regularizers.l2({ l2: 0.01 })
    }));

    model.add(this.tf.layers.dropout({ rate: 0.2 }));

    // Hidden layer 3
    model.add(this.tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));

    // Output layer (binary classification: correct/incorrect)
    model.add(this.tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));

    // Compile model
    model.compile({
      optimizer: this.tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Train neural network for a specific field
   */
  async trainField(field, trainingData, options = {}) {
    const { epochs = 50, batchSize = 16, validationSplit = 0.2, verbose = 1 } = options;

    // Load TensorFlow
    await this.loadTensorFlow();
    if (!this.tf) {
      console.warn('Cannot train neural network: TensorFlow.js not available');
      return null;
    }

    if (trainingData.length < 20) {
      console.warn(`Not enough training data for ${field}: ${trainingData.length} (minimum 20)`);
      return null;
    }

    console.log(`Training neural network for ${field} with ${trainingData.length} examples...`);

    // Prepare training data
    const X = trainingData.map(ex => 
      this.featureNames.map(f => ex.features[f] || 0)
    );
    const y = trainingData.map(ex => [ex.label]);

    // Convert to tensors
    const xs = this.tf.tensor2d(X);
    const ys = this.tf.tensor2d(y);

    // Build model
    const model = this.buildModel();

    // Train with callbacks
    const history = { logs: [] };
    await model.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit,
      verbose,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          history.logs.push(logs);
          if (verbose >= 1 && epoch % 10 === 0) {
            console.log(`  Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, acc = ${logs.acc.toFixed(4)}`);
          }
        }
      }
    });

    // Store model
    this.models[field] = model;
    this.isLoaded = true;

    // Cleanup tensors
    xs.dispose();
    ys.dispose();

    console.log(`  Training complete for ${field}. Final accuracy: ${history.logs[history.logs.length - 1]?.acc?.toFixed(4)}`);

    return history;
  }

  /**
   * Train neural networks for all fields
   */
  async train(allTrainingData, options = {}) {
    const { epochs = 50, batchSize = 16, verbose = 1 } = options;
    const results = {};

    for (const field of this.fieldNames) {
      const fieldData = allTrainingData.filter(ex => ex.field === field);
      
      if (fieldData.length < 20) {
        console.warn(`Skipping ${field}: only ${fieldData.length} examples`);
        continue;
      }

      const history = await this.trainField(field, fieldData, { epochs, batchSize, verbose });
      results[field] = history;
    }

    return results;
  }

  /**
   * Predict confidence for a single candidate
   */
  predict(field, features) {
    if (!this.models[field] || !this.tf) {
      // Fallback to random guess if model not loaded
      return 0.5;
    }

    return this.tf.tidy(() => {
      const X = this.tf.tensor2d([this.featureNames.map(f => features[f] || 0)]);
      const prediction = this.models[field].predict(X);
      const probability = prediction.dataSync()[0];
      return probability;
    });
  }

  /**
   * Predict for multiple candidates (batch)
   */
  predictBatch(field, featuresArray) {
    if (!this.models[field] || !this.tf) {
      return featuresArray.map(() => 0.5);
    }

    return this.tf.tidy(() => {
      const X = this.tf.tensor2d(
        featuresArray.map(f => this.featureNames.map(fn => f[fn] || 0))
      );
      const predictions = this.models[field].predict(X);
      return Array.from(predictions.dataSync());
    });
  }

  /**
   * Save all models to disk
   */
  async saveModels(basePath) {
    if (!this.isLoaded) {
      throw new Error('No models to save. Train models first.');
    }

    const fs = require('fs');
    const path = require('path');

    // Create directory if it doesn't exist
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    // Save each field's model
    for (const [field, model] of Object.entries(this.models)) {
      const modelPath = path.join(basePath, field);
      await model.save(`file://${modelPath}`);
      console.log(`Saved model for ${field} to ${modelPath}`);
    }

    // Save metadata
    const metadata = {
      featureNames: this.featureNames,
      inputSize: this.inputSize,
      fieldNames: this.fieldNames,
      trainedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(basePath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`Saved neural network models to ${basePath}`);
  }

  /**
   * Load models from disk
   */
  async loadModels(basePath) {
    await this.loadTensorFlow();
    if (!this.tf) return false;

    const fs = require('fs');
    const path = require('path');

    // Load metadata
    const metadataPath = path.join(basePath, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      console.warn('Neural network metadata not found. Models may not be trained yet.');
      return false;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    this.featureNames = metadata.featureNames || this.featureNames;
    this.inputSize = metadata.inputSize || this.inputSize;
    this.fieldNames = metadata.fieldNames || this.fieldNames;

    // Load each field's model
    for (const field of this.fieldNames) {
      const modelPath = path.join(basePath, field);
      try {
        this.models[field] = await this.tf.loadLayersModel(`file://${modelPath}/model.json`);
        console.log(`Loaded model for ${field}`);
      } catch (error) {
        console.warn(`Could not load model for ${field}: ${error.message}`);
      }
    }

    this.isLoaded = Object.keys(this.models).length > 0;
    return this.isLoaded;
  }

  /**
   * Check if neural network is available
   */
  isAvailable() {
    return this.isLoaded && Object.keys(this.models).length > 0;
  }

  /**
   * Get model statistics
   */
  getStats() {
    return {
      available: this.isAvailable(),
      modelsCount: Object.keys(this.models).length,
      fields: Object.keys(this.models),
      featureCount: this.featureNames.length,
      tensorflowLoaded: !!this.tf
    };
  }
}

// Export the new intelligent classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    InvoiceExtractor,
    IntelligentInvoiceExtractor,
    DecisionEngine,
    ContextReasoner,
    LearningSystem,
    NeuralReranker,
    DECISION_THRESHOLDS
  };
}

// Expose for browsers
if (typeof window !== 'undefined') {
  window.InvoiceExtractor = InvoiceExtractor;
}

// =========================================================================
// EXAMPLE USAGE WITH USER INPUT
// =========================================================================

if (typeof require !== 'undefined' && require.main === module) {
  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('=== Invoice OCR Text Extractor ===\n');
  console.log('Enter your invoice text (multi-line).');
  console.log('When finished, type "END" on a new line and press Enter.\n');
  console.log('Enter the text:');

  const lines = [];

  rl.on('line', (line) => {
    if (line.trim().toUpperCase() === 'END') {
      rl.close();
    } else {
      lines.push(line);
    }
  });

  rl.on('close', () => {
    const inputText = lines.join('\n');

    if (inputText.trim().length === 0) {
      console.log('\nNo text entered. Exiting.');
      return;
    }

    console.log('\n=== Processing Invoice ===\n');

    const extractor = new InvoiceExtractor();
    const result = extractor.extract(inputText);

    console.log('Extracted Data:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n=== Extraction Complete ===');
  });
}
