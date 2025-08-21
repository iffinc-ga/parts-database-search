import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, X, Upload, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

const PartsSearchTool = () => {
  const [partsData, setPartsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [results, setResults] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [showMatchingModal, setShowMatchingModal] = useState(false);
  const [unmatchedParts, setUnmatchedParts] = useState([]);
  const [selectedUnmatched, setSelectedUnmatched] = useState(null);
  const [searchForMatching, setSearchForMatching] = useState('');
  const [matchingSuggestions, setMatchingSuggestions] = useState([]);
  const [newlyMatchedParts, setNewlyMatchedParts] = useState([]);
  const [matchingSearchType, setMatchingSearchType] = useState('description');

  // Load the Excel file on component mount
  useEffect(() => {
    loadPartsData();
  }, []);

  const loadPartsData = async () => {
    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/parts_db_8.1.2025.xlsx`);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const parts = jsonData.slice(1).map((row, index) => ({
        id: index,
        eurolinkItem: row[0] || '',
        description1: row[1] || '',
        description2: row[2] || '',
        vendorCode: row[3] || '',
        vendorItem: row[4] || '',
        tariff: row[5] || '',
        category: row[6] || '',
        subCategory: row[7] || '',
        vendorName: row[8] || '',
        vendorAddress: row[9] || '',
        city: row[11] || '',
        state: row[12] || '',
        zip: row[13] || ''
      }));
      
      setPartsData(parts);
      setResults(parts.slice(0, 50));
      setLoading(false);
    } catch (error) {
      console.error('Error loading parts data:', error);
      setLoading(false);
      alert('Error loading parts database. Please ensure the Excel file is uploaded to the public folder.');
    }
  };

  // Search functionality
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) {
      return results;
    }

    const terms = searchTerm.toLowerCase().trim().split(/\s+/);
    
    return partsData.filter(part => {
      switch (searchType) {
        case 'eurolink':
          return terms.every(term => part.eurolinkItem.toLowerCase().includes(term));
        case 'supplier':
          return terms.every(term => part.vendorItem.toLowerCase().includes(term));
        case 'description':
          return terms.every(term => 
            part.description1.toLowerCase().includes(term) || 
            part.description2.toLowerCase().includes(term)
          );
        case 'tariff':
          return terms.every(term => part.tariff.toLowerCase().includes(term));
        default:
          return terms.every(term =>
            part.eurolinkItem.toLowerCase().includes(term) ||
            part.vendorItem.toLowerCase().includes(term) ||
            part.description1.toLowerCase().includes(term) ||
            part.description2.toLowerCase().includes(term) ||
            part.tariff.toLowerCase().includes(term) ||
            part.vendorName.toLowerCase().includes(term)
          );
      }
    }).slice(0, 100);
  }, [searchTerm, searchType, partsData, results]);

  const handleSearch = () => {};

  const clearSearch = () => {
    setSearchTerm('');
    setResults(partsData.slice(0, 50));
  };

  const exportResults = () => {
    const dataToExport = filteredResults.map(part => ({
      'Eurolink Item#': part.eurolinkItem,
      'Description 1': part.description1,
      'Description 2': part.description2,
      'Vendor Code': part.vendorCode,
      'Supplier Part#': part.vendorItem,
      'Tariff Code': part.tariff,
      'Category': part.category,
      'Sub Category': part.subCategory,
      'Vendor Name': part.vendorName
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Search Results');
    XLSX.writeFile(wb, 'parts_search_results.xlsx');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      processUploadedFile(file);
    }
  };

  const processUploadedFile = async (file) => {
    setProcessingUpload(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        alert('The uploaded file appears to be empty.');
        setProcessingUpload(false);
        return;
      }

      const headers = jsonData[0];
      const primaryPartCol = headers.findIndex(h => 
        h && h.toString().toUpperCase().includes('PRIMARY') && h.toString().toUpperCase().includes('PART')
      );
      const tariffCol = headers.findIndex(h => 
        h && h.toString().toUpperCase().includes('TARIFF') && h.toString().toUpperCase().includes('NUM')
      );

      if (primaryPartCol === -1 || tariffCol === -1) {
        alert('Could not find required columns in uploaded file.');
        setProcessingUpload(false);
        return;
      }

      const eurolinkMap = new Map();
      const supplierMap = new Map();
      
      partsData.forEach(part => {
        if (part.eurolinkItem) eurolinkMap.set(part.eurolinkItem.trim().toUpperCase(), part.tariff);
        if (part.vendorItem) supplierMap.set(part.vendorItem.trim().toUpperCase(), part.tariff);
      });

      let matchedCount = 0;
      const notFoundParts = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const primaryPart = row[primaryPartCol]?.toString().trim();
        if (primaryPart) {
          const upperPart = primaryPart.toUpperCase();
          let tariffCode = eurolinkMap.get(upperPart) || supplierMap.get(upperPart);
          if (tariffCode) {
            row[tariffCol] = tariffCode;
            matchedCount++;
          } else {
            if (!notFoundParts.includes(primaryPart)) {
              notFoundParts.push(primaryPart);
            }
          }
        }
      }

      const notFoundCount = jsonData.slice(1).filter(row => {
        const primaryPart = row[primaryPartCol]?.toString().trim();
        if (!primaryPart) return false;
        const upperPart = primaryPart.toUpperCase();
        const tariffCode = eurolinkMap.get(upperPart) || supplierMap.get(upperPart);
        return !tariffCode;
      }).length;

      const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Updated Data');

      setUploadResults({
        data: jsonData,
        workbook: newWorkbook,
        matched: matchedCount,
        notFound: notFoundCount,
        notFoundParts: notFoundParts.slice(0, 20),
        totalNotFound: notFoundParts.length,
        uniqueNotFoundCount: notFoundParts.length,
        totalUnmatchedRows: notFoundCount,
        allUnmatchedParts: notFoundParts
      });

    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please make sure it\'s a valid Excel file.');
    }
    setProcessingUpload(false);
  };

  const downloadUpdatedFile = () => {
    if (uploadResults?.workbook) {
      const fileName = uploadedFile.name.replace(/\.[^/.]+$/, '_with_tariffs.xlsx');
      XLSX.writeFile(uploadResults.workbook, fileName);
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadResults(null);
    setNewlyMatchedParts([]);
  };

  const openMatchingModal = () => {
    if (uploadResults?.allUnmatchedParts) {
      setUnmatchedParts(uploadResults.allUnmatchedParts);
      setShowMatchingModal(true);
    }
  };

  // ✅ Fixed function
  const searchForMatchingParts = (searchTerm) => {
    if (!searchTerm.trim()) {
      setMatchingSuggestions([]);
      return;
    }

    const terms = searchTerm.toLowerCase().trim().split(/\s+/);

    const suggestions = partsData.filter(part => {
      return terms.every(term => {
        const escapedTerm = term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}(-\\d+)?\\b`, "i");

        const fieldsToSearch = matchingSearchType === 'description'
          ? [part.description1, part.description2]
          : [part.eurolinkItem, part.vendorItem, part.description1, part.description2];

        return fieldsToSearch.some(field => {
          if (!field) return false;
          if (/^\d+$/.test(term)) {
            return regex.test(field);
          } else {
            return field.toLowerCase().includes(term);
          }
        });
      });
    }).slice(0, 10);

    setMatchingSuggestions(suggestions);
  };

  // The rest of your JSX remains unchanged
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold">Parts Database Search</h1>
        {/* Keep your existing JSX here (upload, results table, modals, etc.) */}
      </div>
    </div>
  );
};

export default PartsSearchTool;
