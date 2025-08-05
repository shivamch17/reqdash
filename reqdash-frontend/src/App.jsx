import { useState, useRef, useEffect } from 'react';
import ReactJson from 'react-json-view';
import loadingSvg from './assets/loader.svg';

function App() {
  const [curlInput, setCurlInput] = useState('');
  const [parsedJson, setParsedJson] = useState(null);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [isAddingHeader, setIsAddingHeader] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [response, setResponse] = useState({ status: null, statusText: '', headers: {}, data: null });
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedRequests, setShowSavedRequests] = useState(false);
  const [savedRequests, setSavedRequests] = useState([]);
  const [isRequestCollapsed, setIsRequestCollapsed] = useState(false);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    adjustTextareaHeight();
  }, [curlInput]);

  useEffect(() => {
    // Load saved requests from localStorage on component mount
    const saved = localStorage.getItem('savedRequests');
    if (saved) {
      setSavedRequests(JSON.parse(saved));
    }
  }, []);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  const parseCurl = (curl) => {
    const parsed = {
      url: '',
      method: 'GET',
      headers: {},
      data: null,
    };

    const urlMatch = curl.match(/(?:curl\s+)(['"]?)(https?:\/\/[^\s'"]+)\1/);
    if (urlMatch) {
      parsed.url = urlMatch[2];
    }

    if (/--data(?:-raw)?/.test(curl)) {
      parsed.method = 'POST';
    }

    const headerMatches = curl.match(/-H\s+['"](.*?)['"]/g);
    if (headerMatches) {
      headerMatches.forEach((header) => {
        const [key, value] = header
          .replace(/-H\s+['"]/, '')
          .replace(/['"]$/, '')
          .split(/:\s(.+)/);
        parsed.headers[key?.trim()] = value?.trim();
      });
    }

    const dataMatch = curl.match(/--data(?:-raw)?\s+(['"])(.*?)\1/);
    if (dataMatch) {
      try {
        parsed.data = JSON.parse(dataMatch[2]);
      } catch (e) {
        parsed.data = dataMatch[2];
      }
    }

    return parsed;
  };

  const handleParse = () => {
    setParsedJson(parseCurl(curlInput));
  };

  const copyToClipboard = () => {
    if (parsedJson) {
      const currentState = {
        method: parsedJson.method,
        url: parsedJson.url,
        headers: parsedJson.headers,
        data: parsedJson.data
      };
      navigator.clipboard.writeText(JSON.stringify(currentState, null, 2))
        .then(() => {
          // Show a notification using react-hot-toast
          const copyButton = document.querySelector('[data-copy-button]');
          if (copyButton) {
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
              copyButton.textContent = originalText;
            }, 2000);
          }
        })
        .catch(err => console.error('Failed to copy:', err));
    }
  };

  const handleUrlChange = (e) => {
    setParsedJson(prev => ({
      ...prev,
      url: e.target.value
    }));
  };

  const handleMethodChange = (e) => {
    setParsedJson(prev => ({
      ...prev,
      method: e.target.value
    }));
  };

  const handleJsonEdit = (edit) => {
    setParsedJson(prev => {
      const newJson = { ...prev };
      if (edit.namespace.includes('data')) {
        newJson.data = edit.updated_src;
      } else if (edit.namespace.includes('headers')) {
        newJson.headers = edit.updated_src;
      }
      return newJson;
    });
  };

  const startAddingHeader = () => {
    setIsAddingHeader(true);
    setNewHeaderKey('');
    setNewHeaderValue('');
  };

  const cancelAddingHeader = () => {
    setIsAddingHeader(false);
    setNewHeaderKey('');
    setNewHeaderValue('');
  };

  const addNewHeader = () => {
    if (newHeaderKey.trim()) {
      setParsedJson(prev => ({
        ...prev,
        headers: {
          ...prev.headers,
          [newHeaderKey.trim()]: newHeaderValue.trim()
        }
      }));
      setIsAddingHeader(false);
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const updateHeaderKey = (oldKey, newKey) => {
    if (newKey.trim() && newKey !== oldKey) {
      setParsedJson(prev => {
        const newHeaders = { ...prev.headers };
        const value = newHeaders[oldKey];
        delete newHeaders[oldKey];
        newHeaders[newKey.trim()] = value;
        return {
          ...prev,
          headers: newHeaders
        };
      });
    }
  };

  const updateHeaderValue = (key, value) => {
    setParsedJson(prev => ({
      ...prev,
      headers: {
        ...prev.headers,
        [key]: value
      }
    }));
  };

  const deleteHeader = (key) => {
    setParsedJson(prev => {
      const newHeaders = { ...prev.headers };
      delete newHeaders[key];
      return {
        ...prev,
        headers: newHeaders
      };
    });
  };

  const sendRequest = async () => {
    if (!parsedJson) return;

    if (isLoading) {
      // Cancel the ongoing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setResponse({
        error: true,
        message: 'Request cancelled'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      const response = await fetch('https://reqdash.shivamch17.workers.dev/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: parsedJson.method,
          url: parsedJson.url,
          headers: parsedJson.headers,
          data: parsedJson.data
        }),
        signal: abortControllerRef.current.signal
      });

      const data = await response.json();
      setResponse(data);
    } catch (error) {
      if (error.name === 'AbortError') {
        // Don't set response here since we already set it above when cancelling
        return;
      }
      setResponse({
        error: true,
        message: error.message
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const isJsonString = (str) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const renderResponseData = (data) => {
    if (data === null || data === undefined) {
      return <div className="text-gray-400">No response data</div>;
    }

    // If data is already an object, or if it's a JSON string
    if (typeof data === 'object' || isJsonString(data)) {
      const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
      return (
        <ReactJson
          src={jsonData}
          theme="monokai"
          displayDataTypes={false}
          name={false}
          enableClipboard={false}
          displayObjectSize={true}
          style={{ backgroundColor: 'transparent' }}
        />
      );
    }

    // For non-JSON data, display as raw text
    return (
      <pre className="whitespace-pre-wrap break-words text-white font-mono text-sm">
        {String(data)}
      </pre>
    );
  };

  const saveRequest = () => {
    if (!parsedJson) return;

    const newRequest = {
      id: Date.now(),
      name: window.prompt('Enter a name for this request:'),
      request: parsedJson
    };

    if (!newRequest.name) return; // User cancelled the prompt

    const updatedRequests = [...savedRequests, newRequest];
    setSavedRequests(updatedRequests);
    localStorage.setItem('savedRequests', JSON.stringify(updatedRequests));
  };

  const loadRequest = (request) => {
    setParsedJson(request.request);
    setShowSavedRequests(false);
    setCurlInput(''); // Clear the curl input as we're loading a saved request
  };

  const deleteRequest = (id) => {
    const updatedRequests = savedRequests.filter(req => req.id !== id);
    setSavedRequests(updatedRequests);
    localStorage.setItem('savedRequests', JSON.stringify(updatedRequests));
  };

  const handleNewRequest = () => {
    setParsedJson(null);
    setCurlInput('');
    setResponse({ status: null, statusText: '', headers: {}, data: null });
    handleParse();
  };

  return (
    <div className="p-5 font-sans bg-postman-bg text-white min-h-screen">
      <h1 className="text-postman-red text-3xl font-bold mb-6">ReqDash</h1>

      {/* Input Section */}
      <div className="mb-5">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[100px] p-3 bg-postman-secondary text-white border border-postman-border rounded-md focus:outline-none focus:ring-2 focus:ring-postman-red resize-none overflow-hidden"
          value={curlInput}
          onChange={(e) => setCurlInput(e.target.value)}
          placeholder="Paste your cURL command here..."
        />
        <button
          onClick={handleParse}
          className="px-5 py-2.5 bg-postman-red text-white rounded-md hover:bg-opacity-90 transition-colors mr-3"
        >
          Parse cURL
        </button>
        <button
          onClick={handleNewRequest}
          className="px-5 py-2.5 bg-postman-red text-white rounded-md hover:bg-opacity-90 transition-colors mr-3"
        >
          New Request
        </button>
        <button
          onClick={() => setShowSavedRequests(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-opacity-90 transition-colors mr-3"
        >
          Saved Requests
        </button>
      </div>

      {/* Saved Requests Modal */}
      {showSavedRequests && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-postman-secondary rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="bg-postman-secondary p-4 border-b border-postman-border flex justify-between items-center">
              <h3 className="text-xl font-semibold">Saved Requests</h3>
              <button
                onClick={() => setShowSavedRequests(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {savedRequests.length === 0 ? (
                <div className="text-gray-400 text-center">No saved requests</div>
              ) : (
                <div className="space-y-3">
                  {savedRequests.map((req) => (
                    <div key={req.id} className="bg-postman-bg p-3 rounded-md flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{req.name}</h4>
                        <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs text-gray-200 ${req.request.method === 'GET' ? 'bg-green-600' :
                            req.request.method === 'POST' ? 'bg-yellow-600' :
                              req.request.method === 'PUT' ? 'bg-blue-600' :
                                req.request.method === 'DELETE' ? 'bg-red-600' :
                                  'bg-gray-600'
                            }`}>
                            {req.request.method}
                          </span>
                          <span className="truncate">{req.request.url}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => loadRequest(req)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteRequest(req.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request Details Section */}
      {parsedJson && (
        <div className="mt-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-2xl font-semibold m-0">Request Details</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowJsonModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Show JSON
              </button>
              <button
                onClick={saveRequest}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Save Request
              </button>
            </div>
          </div>

          {/* Method and URL */}
          <div className="bg-postman-secondary p-4 rounded-md mb-4">
            <div className="flex items-center gap-3">
              <select
                value={parsedJson.method}
                onChange={handleMethodChange}
                className="bg-green-600 px-3 py-1.5 rounded-md font-bold text-white border-none focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
              <input
                type="text"
                value={parsedJson.url}
                onChange={handleUrlChange}
                className="flex-1 bg-postman-bg text-white px-3 py-1.5 rounded-md border border-postman-border focus:outline-none focus:ring-2 focus:ring-postman-red"
              />
              <button
                onClick={sendRequest}
                className={`px-4 py-1.5 ${isLoading ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-md transition-colors whitespace-nowrap`}
              >
                {isLoading ? 'Cancel' : 'Send'}
              </button>
            </div>
          </div>

          {/* Request Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-semibold">Request</h2>
              <button
                onClick={() => setIsRequestCollapsed(!isRequestCollapsed)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isRequestCollapsed ? "Expand" : "Collapse"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transform transition-transform ${isRequestCollapsed ? '-rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ${isRequestCollapsed ? 'hidden' : ''}`}>
              {/* Headers */}
              <div className="bg-postman-secondary p-4 rounded-md">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xl font-semibold">Headers</h3>
                  <button
                    onClick={startAddingHeader}
                    className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    Add Header
                  </button>
                </div>
                <div className="pl-1 space-y-1 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#FF6C37] [&::-webkit-scrollbar-thumb]:rounded-[10px] pr-2">
                  {Object.entries(parsedJson.headers).map(([key, value]) => (
                    <div key={key} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => updateHeaderKey(key, e.target.value)}
                        className="flex-1 bg-postman-bg text-white px-2 py-1 text-sm rounded-md border border-postman-border focus:outline-none focus:ring-1 focus:ring-postman-red"
                        placeholder="Header Key"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateHeaderValue(key, e.target.value)}
                        className="flex-1 bg-postman-bg text-white px-2 py-1 text-sm rounded-md border border-postman-border focus:outline-none focus:ring-1 focus:ring-postman-red"
                        placeholder="Header Value"
                      />
                      <button
                        onClick={() => deleteHeader(key)}
                        className="px-1.5 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0111 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {isAddingHeader && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Header Key"
                        value={newHeaderKey}
                        onChange={(e) => setNewHeaderKey(e.target.value)}
                        className="flex-1 bg-postman-bg text-white px-2 py-1 text-sm rounded-md border border-postman-border focus:outline-none focus:ring-1 focus:ring-postman-red"
                      />
                      <input
                        type="text"
                        placeholder="Header Value"
                        value={newHeaderValue}
                        onChange={(e) => setNewHeaderValue(e.target.value)}
                        className="flex-1 bg-postman-bg text-white px-2 py-1 text-sm rounded-md border border-postman-border focus:outline-none focus:ring-1 focus:ring-postman-red"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={cancelAddingHeader}
                          className="px-1.5 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={addNewHeader}
                          className="px-1.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Request Body */}
              <div className="bg-postman-secondary p-4 rounded-md">
                <h3 className="text-xl font-semibold mb-2">Body</h3>
                <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#FF6C37] [&::-webkit-scrollbar-thumb]:rounded-[10px] pr-2">
                  <ReactJson
                    src={parsedJson.data || {}}
                    theme="monokai"
                    displayDataTypes={false}
                    name="data"
                    onEdit={handleJsonEdit}
                    onAdd={handleJsonEdit}
                    onDelete={handleJsonEdit}
                    enableClipboard={false}
                    displayObjectSize={true}
                    style={{ backgroundColor: 'transparent' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Response Section */}
          {response && (
            <div className={`${isLoading ? 'pointer-events-none' : ''}`}>
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-2xl font-semibold">Response</h2>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-sm font-medium ${response.status >= 200 && response.status < 300
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                    }`}>
                    {response.status}
                  </span>
                  <span className="text-gray-400">{response.statusText}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Response Headers */}
                <div className="bg-postman-secondary p-4 rounded-md">
                  <h3 className="text-xl font-semibold mb-2">Headers</h3>
                  <div className="relative">
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 backdrop-blur-sm rounded-md">
                        <img src={loadingSvg} alt="Loading..." className="w-12 h-12 animate-spin" />
                      </div>
                    )}
                    <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#FF6C37] [&::-webkit-scrollbar-thumb]:rounded-[10px] pr-2">
                      <ReactJson
                        src={response.headers || {}}
                        theme="monokai"
                        displayDataTypes={false}
                        name={false}
                        enableClipboard={false}
                        displayObjectSize={true}
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-postman-secondary p-4 rounded-md">
                  <h3 className="text-xl font-semibold mb-2">Data</h3>
                  <div className="relative">
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 backdrop-blur-sm rounded-md">
                        <img src={loadingSvg} alt="Loading..." className="w-12 h-12 animate-spin" />
                      </div>
                    )}
                    {/* Response Data */}
                    <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#FF6C37] [&::-webkit-scrollbar-thumb]:rounded-[10px] pr-2">
                      {renderResponseData(response.data)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-postman-secondary rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="bg-postman-secondary p-4 border-b border-postman-border flex justify-between items-center">
              <h3 className="text-xl font-semibold">Complete JSON</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyToClipboard}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Copy JSON"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowJsonModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#FF6C37] [&::-webkit-scrollbar-thumb]:rounded-[10px]">
              <ReactJson
                src={parsedJson}
                theme="monokai"
                displayDataTypes={false}
                name={false}
                enableClipboard={false}
                displayObjectSize={true}
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
