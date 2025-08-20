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
  const [newlyMatchedParts, setNewlyMatchedParts] = useState([]); // Track newly matched parts

  // Load the Excel file on component mount
  useEffect(() => {
    loadPartsData();
  }, []);

  const loadPartsData = async () => {
    try {
      // For GitHub deployment, you'll need to place your Excel file in the public folder
      // and update this path accordingly
      const response = await fetch(`${process.env.PUBLIC_URL}/parts_db_8.1.2025.xlsx`);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Skip header row and convert to objects
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
      setResults(parts.slice(0, 50)); // Show first 50 initially
      setLoading(false);
    } catch (error) {
      console.error('Error loading parts data:', error);
      setLoading(false);
      // You might want to show an error message to the user here
      alert('Error loading parts database. Please ensure the Excel file is uploaded to the public folder.');
    }
  };

  // Search functionality
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) {
      return results;
    }

    const terms = searchTerm.toLowerCase().trim().split(/\s+/); // Split by whitespace
    
    return partsData.filter(part => {
      switch (searchType) {
        case 'eurolink':
          return terms.every(term => part.eurolinkItem.toLowerCase().includes(term));
        case 'supplier':
          return terms.every(term => part.vendorItem.toLowerCase().includes(term));
        case 'description':
          // For descriptions, ALL terms must be found somewhere in EITHER description field
          return terms.every(term => 
            part.description1.toLowerCase().includes(term) || 
            part.description2.toLowerCase().includes(term)
          );
        case 'tariff':
          return terms.every(term => part.tariff.toLowerCase().includes(term));
        default: // 'all'
          // For "all fields", ALL terms must be found somewhere across ALL fields
          return terms.every(term =>
            part.eurolinkItem.toLowerCase().includes(term) ||
            part.vendorItem.toLowerCase().includes(term) ||
            part.description1.toLowerCase().includes(term) ||
            part.description2.toLowerCase().includes(term) ||
            part.tariff.toLowerCase().includes(term) ||
            part.vendorName.toLowerCase().includes(term)
          );
      }
    }).slice(0, 100); // Limit to 100 results for performance
  }, [searchTerm, searchType, partsData, results]);

  const handleSearch = () => {
    // Search is handled by useMemo, this is just for the button
  };

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

  // Handle file upload for tariff population
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

      // Find column indices
      const headers = jsonData[0];
      const primaryPartCol = headers.findIndex(h => 
        h && h.toString().toUpperCase().includes('PRIMARY') && h.toString().toUpperCase().includes('PART')
      );
      const tariffCol = headers.findIndex(h => 
        h && h.toString().toUpperCase().includes('TARIFF') && h.toString().toUpperCase().includes('NUM')
      );

      if (primaryPartCol === -1) {
        alert('Could not find a "PRIMARY PART NUMBER" column in the uploaded file.');
        setProcessingUpload(false);
        return;
      }

      if (tariffCol === -1) {
        alert('Could not find a "TARIFF NUM" column in the uploaded file.');
        setProcessingUpload(false);
        return;
      }

      // Create lookup maps for faster searching
      const eurolinkMap = new Map();
      const supplierMap = new Map();
      
      partsData.forEach(part => {
        if (part.eurolinkItem) {
          eurolinkMap.set(part.eurolinkItem.trim().toUpperCase(), part.tariff);
        }
        if (part.vendorItem) {
          supplierMap.set(part.vendorItem.trim().toUpperCase(), part.tariff);
        }
      });

      // Process each row
      let matchedCount = 0;
      let notFoundCount = 0;
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
            // Only add to notFoundParts if it's not already there (avoid duplicates)
            if (!notFoundParts.includes(primaryPart)) {
              notFoundParts.push(primaryPart);
            }
          }
        }
      }

      // Count actual unmatched rows for accurate reporting
      notFoundCount = jsonData.slice(1).filter(row => {
        const primaryPart = row[primaryPartCol]?.toString().trim();
        if (!primaryPart) return false;
        const upperPart = primaryPart.toUpperCase();
        const tariffCode = eurolinkMap.get(upperPart) || supplierMap.get(upperPart);
        return !tariffCode;
      }).length;

      // Create updated workbook
      const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Updated Data');

      setUploadResults({
        data: jsonData,
        workbook: newWorkbook,
        matched: matchedCount,
        notFound: notFoundCount,
        notFoundParts: notFoundParts.slice(0, 20), // Show first 20 not found
        totalNotFound: notFoundParts.length, // This is now unique parts count
        uniqueNotFoundCount: notFoundParts.length, // Track unique count separately
        totalUnmatchedRows: notFoundCount, // Track total unmatched rows
        allUnmatchedParts: notFoundParts // Store all unmatched for matching feature
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
    setNewlyMatchedParts([]); // Clear newly matched parts when clearing upload
  };

  // Matching functionality for unmatched parts
  const openMatchingModal = () => {
    if (uploadResults?.allUnmatchedParts) {
      setUnmatchedParts(uploadResults.allUnmatchedParts);
      setShowMatchingModal(true);
    }
  };

  const searchForMatchingParts = (searchTerm) => {
    if (!searchTerm.trim()) {
      setMatchingSuggestions([]);
      return;
    }

    const terms = searchTerm.toLowerCase().trim().split(/\s+/);
    
    const suggestions = partsData.filter(part => {
      // For matching, ALL terms must be found somewhere in the part data
      return terms.every(term => {
        // Create variations of the term for better matching
        const termVariations = [
          term,                          // exact term: "14399"
          term.replace(/[-\s]/g, ''),    // remove hyphens/spaces: "14399"
          term + '-',                    // add hyphen: "14399-"
          '-' + term,                    // prepend hyphen: "-14399"
          term.replace(/(\d+)/, '$1-')   // add hyphen after numbers: "14399-"
        ];
        
        // Check all fields with all variations
        return termVariations.some(variation => 
          part.eurolinkItem.toLowerCase().includes(variation) ||
          part.vendorItem.toLowerCase().includes(variation) ||
          part.description1.toLowerCase().includes(variation) || 
          part.description2.toLowerCase().includes(variation)
        );
      });
    }).slice(0, 10); // Limit to 10 suggestions

    setMatchingSuggestions(suggestions);
  };

  const addMatchToTariffSheet = async (unmatchedPartNumber, matchedPart) => {
    // Find ALL rows in the original uploaded data that contain this unmatched part
    const uploadData = uploadResults.data;
    const headers = uploadData[0];
    const primaryPartCol = headers.findIndex(h => 
      h && h.toString().toUpperCase().includes('PRIMARY') && h.toString().toUpperCase().includes('PART')
    );
    const tariffCol = headers.findIndex(h => 
      h && h.toString().toUpperCase().includes('TARIFF') && h.toString().toUpperCase().includes('NUM')
    );

    let rowsUpdated = 0;
    // Find and update ALL rows with this part number (don't break after first match)
    for (let i = 1; i < uploadData.length; i++) {
      const row = uploadData[i];
      if (row[primaryPartCol]?.toString().trim() === unmatchedPartNumber) {
        // Add the tariff code to this row
        row[tariffCol] = matchedPart.tariff;
        rowsUpdated++;
      }
    }

    // Track this newly matched part for the separate tab
    const newlyMatched = {
      partNumber: unmatchedPartNumber,
      tariffCode: matchedPart.tariff,
      matchedFrom: matchedPart.eurolinkItem,
      description1: matchedPart.description1,
      description2: matchedPart.description2,
      vendorName: matchedPart.vendorName,
      rowsUpdated: rowsUpdated // Track how many rows were updated
    };

    const updatedNewlyMatched = [...newlyMatchedParts, newlyMatched];
    setNewlyMatchedParts(updatedNewlyMatched);

    // Remove from unmatched list
    const updatedUnmatched = unmatchedParts.filter(part => part !== unmatchedPartNumber);
    setUnmatchedParts(updatedUnmatched);

    // Update upload results
    const updatedUploadResults = {
      ...uploadResults,
      data: uploadData, // Updated data with new tariff
      matched: uploadResults.matched + rowsUpdated, // Add the actual number of rows updated
      notFound: uploadResults.notFound - 1, // Only subtract 1 from unique unmatched parts
      allUnmatchedParts: updatedUnmatched
    };

    // Create updated workbook with both tabs
    const newWorksheet = XLSX.utils.aoa_to_sheet(uploadData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Updated Data');

    // Add "Newly Matched" tab if there are newly matched parts
    if (updatedNewlyMatched.length > 0) {
      const newlyMatchedData = [
        ['Part Number', 'Tariff Code', 'Matched From', 'Description 1', 'Description 2', 'Vendor Name', 'Rows Updated'],
        ...updatedNewlyMatched.map(part => [
          part.partNumber,
          part.tariffCode,
          part.matchedFrom,
          part.description1,
          part.description2,
          part.vendorName,
          part.rowsUpdated
        ])
      ];
      const newlyMatchedSheet = XLSX.utils.aoa_to_sheet(newlyMatchedData);
      XLSX.utils.book_append_sheet(newWorkbook, newlyMatchedSheet, 'Newly Matched');
    }

    updatedUploadResults.workbook = newWorkbook;
    setUploadResults(updatedUploadResults);

    const message = rowsUpdated === 1 
      ? `Successfully added tariff code ${matchedPart.tariff} to ${unmatchedPartNumber}`
      : `Successfully added tariff code ${matchedPart.tariff} to ${unmatchedPartNumber} (${rowsUpdated} rows updated)`;
    
    alert(message);
  };

  const downloadUpdatedDatabase = () => {
    // Create Excel file with updated parts data
    const dataToExport = partsData.map(part => [
      part.eurolinkItem,
      part.description1,
      part.description2,
      part.vendorCode,
      part.vendorItem,
      part.tariff,
      part.category,
      part.subCategory,
      part.vendorName,
      part.vendorAddress,
      '', // Empty column
      part.city,
      part.state,
      part.zip
    ]);

    // Add headers
    const headers = [
      'EUROLINK ITEM#',
      'DESCRIPTION 1',
      'DESCRIPTION 2',
      'VENDOR CODE',
      'VENDOR ITEM #',
      'TARIFF',
      'CATEGORY',
      'SUB CATEGORY',
      'VENDOR NAME',
      'VENDOR ADDRESS',
      'VENDOR ADDRESS',
      'CITY',
      'STATE',
      'ZIP'
    ];

    const finalData = [headers, ...dataToExport];
    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Updated Parts Database');
    XLSX.writeFile(wb, 'updated_parts_database.xlsx');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading parts database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Parts Database Search</h1>
          <p className="text-gray-600">Search through {partsData.length.toLocaleString()} parts by Eurolink part number, supplier part number, description, or tariff code</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Excel File for Tariff Population</h2>
          <p className="text-gray-600 mb-4">
            Upload an Excel file with "PRIMARY PART NUMBER" and "TARIFF NUM" columns. The tool will match part numbers against the database and populate tariff codes.
          </p>
          
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> your Excel file
                  </p>
                  <p className="text-xs text-gray-500">Excel files (.xlsx, .xls)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            
            {uploadedFile && (
              <div className="lg:w-1/3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-900">{uploadedFile.name}</span>
                    </div>
                    <button
                      onClick={clearUpload}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {processingUpload && (
                    <div className="mt-2">
                      <div className="animate-pulse text-xs text-blue-600">Processing file...</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {uploadResults && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Processing Complete!</h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>✓ {uploadResults.matched} part numbers matched and populated with tariff codes</p>
                <p>⚠ {uploadResults.totalUnmatchedRows} unmatched rows ({uploadResults.uniqueNotFoundCount} unique parts)</p>
                {uploadResults.notFoundParts.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Show some unmatched parts</summary>
                    <div className="mt-2 text-xs bg-white rounded p-2 max-h-32 overflow-y-auto">
                      {uploadResults.notFoundParts.map((part, idx) => (
                        <div key={idx} className="text-gray-600">{part}</div>
                      ))}
                      {uploadResults.totalNotFound > 20 && (
                        <div className="text-gray-500 mt-1">... and {uploadResults.totalNotFound - 20} more</div>
                      )}
                    </div>
                  </details>
                )}
              </div>
              <button
                onClick={downloadUpdatedFile}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Updated File {newlyMatchedParts.length > 0 && `(${newlyMatchedParts.length} newly matched)`}
              </button>
              
              {uploadResults.totalNotFound > 0 && (
                <button
                  onClick={openMatchingModal}
                  className="mt-3 ml-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                >
                  <Search className="h-4 w-4" />
                  Match Unmatched Parts ({uploadResults.uniqueNotFoundCount})
                </button>
              )}
              
              {newlyMatchedParts.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Newly Matched Parts Preview:</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    {newlyMatchedParts.slice(0, 3).map((part, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="font-mono">{part.partNumber}</span>
                        <span className="font-mono text-green-700">{part.tariffCode}</span>
                      </div>
                    ))}
                    {newlyMatchedParts.length > 3 && (
                      <div className="text-blue-600">... and {newlyMatchedParts.length - 3} more</div>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 mt-2">
                    ✓ These will be included in your download with a separate "Newly Matched" tab
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Interface */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter part number, description keywords (M20 110 4017), or tariff code..."
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Search All Fields</option>
                <option value="eurolink">Eurolink Part#</option>
                <option value="supplier">Supplier Part#</option>
                <option value="description">Description</option>
                <option value="tariff">Tariff Code</option>
              </select>
              
              <button
                onClick={exportResults}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                <Download className="h-5 w-5" />
                Export
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Showing {filteredResults.length.toLocaleString()} results
            {searchTerm && ` for "${searchTerm}"`}
            {filteredResults.length === 100 && searchTerm && " (limited to first 100)"}
            {searchTerm && searchTerm.includes(' ') && (
              <div className="mt-1 text-xs text-blue-600">
                💡 Tip: Multi-term search - ALL keywords must be present to match
              </div>
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eurolink Part#
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier Part#
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tariff Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResults.map((part, index) => (
                  <tr 
                    key={part.id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPart(part)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {part.eurolinkItem}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      <div className="font-medium">{part.description1}</div>
                      {part.description2 && (
                        <div className="text-gray-500 text-xs mt-1">{part.description2}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {part.vendorItem}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {part.tariff}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate">{part.vendorName}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Part Details Modal */}
        {selectedPart && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Part Details</h2>
                  <button
                    onClick={() => setSelectedPart(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Eurolink Item#</label>
                      <p 
                        className="mt-1 text-lg font-mono text-blue-600 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.eurolinkItem}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Tariff Code</label>
                      <p 
                        className="mt-1 text-lg font-mono text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.tariff}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Description</label>
                    <p 
                      className="mt-1 text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                      onClick={(e) => {
                        const selection = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(e.target);
                        selection.removeAllRanges();
                        selection.addRange(range);
                      }}
                      title="Click to select"
                    >
                      {selectedPart.description1}
                    </p>
                    {selectedPart.description2 && (
                      <p 
                        className="mt-1 text-gray-600 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.description2}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Vendor Code</label>
                      <p 
                        className="mt-1 text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.vendorCode}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Supplier Part#</label>
                      <p 
                        className="mt-1 font-mono text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.vendorItem}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Vendor Information</label>
                    <div className="mt-1 text-gray-900">
                      <p 
                        className="font-medium cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.vendorName}
                      </p>
                      <p 
                        className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.vendorAddress}
                        {selectedPart.city && `, ${selectedPart.city}`}
                        {selectedPart.state && `, ${selectedPart.state}`}
                        {selectedPart.zip && ` ${selectedPart.zip}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Category</label>
                      <p 
                        className="mt-1 text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.category}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Sub Category</label>
                      <p 
                        className="mt-1 text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 select-all"
                        onClick={(e) => {
                          const selection = window.getSelection();
                          const range = document.createRange();
                          range.selectNodeContents(e.target);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        }}
                        title="Click to select"
                      >
                        {selectedPart.subCategory}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Matching Modal for Unmatched Parts */}
        {showMatchingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Match Unmatched Parts</h2>
                  <button
                    onClick={() => setShowMatchingModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left side - Unmatched Parts */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Unmatched Parts ({unmatchedParts.length})</h3>
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      {unmatchedParts.map((part, index) => (
                        <div
                          key={index}
                          className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                            selectedUnmatched === part ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => setSelectedUnmatched(part)}
                        >
                          <span className="font-mono text-sm">{part}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right side - Search and Match */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Find Match for: 
                      {selectedUnmatched && (
                        <span className="font-mono text-blue-600 ml-2">{selectedUnmatched}</span>
                      )}
                    </h3>
                    
                    {selectedUnmatched && (
                      <>
                        <div className="mb-4">
                          <input
                            type="text"
                            value={searchForMatching}
                            onChange={(e) => {
                              setSearchForMatching(e.target.value);
                              searchForMatchingParts(e.target.value);
                            }}
                            placeholder="Search by description keywords..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {matchingSuggestions.length > 0 && (
                          <div className="border rounded-lg max-h-96 overflow-y-auto">
                            <div className="bg-gray-50 px-3 py-2 border-b font-medium text-sm">
                              Suggested Matches ({matchingSuggestions.length})
                            </div>
                            {matchingSuggestions.map((suggestion, index) => (
                              <div
                                key={suggestion.id}
                                className="p-3 border-b hover:bg-gray-50"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-blue-600">
                                      {suggestion.eurolinkItem}
                                    </div>
                                    <div className="text-sm text-gray-900 mt-1">
                                      {suggestion.description1}
                                    </div>
                                    {suggestion.description2 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {suggestion.description2}
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-600 mt-1">
                                      Tariff: <span className="font-mono">{suggestion.tariff}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => addMatchToTariffSheet(selectedUnmatched, suggestion)}
                                    className="ml-3 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                  >
                                    Add to Tariff Sheet
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {searchForMatching && matchingSuggestions.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            No matching parts found. Try different search terms.
                          </div>
                        )}
                      </>
                    )}

                    {!selectedUnmatched && (
                      <div className="text-center py-8 text-gray-500">
                        Select an unmatched part from the left to find matches
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartsSearchTool;
