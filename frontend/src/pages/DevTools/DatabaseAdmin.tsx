import React, { useState, useEffect } from "react";
import { API_URL } from "../../config";

interface TableStructure {
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  primary_key: boolean;
}

interface TableRow {
  [key: string]: unknown;
}

const DatabaseAdmin: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"browse" | "structure" | "insert">("browse");
  const [structure, setStructure] = useState<TableStructure[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const DB_API = `${API_URL}/admin/db`;

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      if (activeTab === "structure") {
        loadStructure();
      } else if (activeTab === "browse") {
        loadRows();
      }
    }
  }, [selectedTable, activeTab]);

  const loadTables = async () => {
    try {
      const res = await fetch(`${DB_API}/tables`);
      const data = await res.json();
      if (data.success) {
        setTables(data.tables);
        if (data.tables.length > 0 && !selectedTable) {
          setSelectedTable(data.tables[0]);
        }
      } else {
        setError(data.error || "Failed to load tables");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const loadStructure = async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      const res = await fetch(`${DB_API}/tables/${selectedTable}/structure`);
      const data = await res.json();
      if (data.success) {
        setStructure(data.structure);
      } else {
        setError(data.error || "Failed to load structure");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const loadRows = async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      const res = await fetch(`${DB_API}/tables/${selectedTable}/rows?limit=100&offset=0`);
      const data = await res.json();
      if (data.success) {
        setRows(data.rows);
        setColumns(data.columns);
      } else {
        setError(data.error || "Failed to load rows");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleInitDb = async () => {
    try {
      const res = await fetch(`${DB_API}/init`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Database initialized");
        loadTables();
      } else {
        setError(data.error || "Failed to initialize database");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r shadow-sm p-4 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800 mb-2">🗄️ Tables</h2>
            <button
              onClick={handleInitDb}
              className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm mb-2"
            >
              Initialize DB
            </button>
            <button
              onClick={loadTables}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-1">
            {tables.map((table) => (
              <button
                key={table}
                onClick={() => setSelectedTable(table)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  selectedTable === table
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                {table}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
              <button
                onClick={() => setError(null)}
                className="float-right font-bold"
              >
                ×
              </button>
            </div>
          )}
          {message && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {message}
              <button
                onClick={() => setMessage(null)}
                className="float-right font-bold"
              >
                ×
              </button>
            </div>
          )}

          {selectedTable ? (
            <>
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  Table: {selectedTable}
                </h1>
                <div className="flex gap-2 border-b">
                  <button
                    onClick={() => setActiveTab("browse")}
                    className={`px-4 py-2 font-medium ${
                      activeTab === "browse"
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    Browse
                  </button>
                  <button
                    onClick={() => setActiveTab("structure")}
                    className={`px-4 py-2 font-medium ${
                      activeTab === "structure"
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    Structure
                  </button>
                  <button
                    onClick={() => setActiveTab("insert")}
                    className={`px-4 py-2 font-medium ${
                      activeTab === "insert"
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    Insert
                  </button>
                </div>
              </div>

              {loading && (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              )}

              {activeTab === "browse" && !loading && (
                <BrowseTab
                  tableName={selectedTable}
                  rows={rows}
                  columns={columns}
                  onRefresh={loadRows}
                />
              )}

              {activeTab === "structure" && !loading && (
                <StructureTab structure={structure} />
              )}

              {activeTab === "insert" && (
                <InsertTab
                  tableName={selectedTable}
                  structure={structure}
                  onInsert={() => {
                    loadRows();
                    setActiveTab("browse");
                  }}
                  onLoadStructure={loadStructure}
                />
              )}
            </>
          ) : (
            <div className="text-center py-16 text-gray-600">
              Select a table from the sidebar to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Browse Tab Component
const BrowseTab: React.FC<{
  tableName: string;
  rows: TableRow[];
  columns: string[];
  onRefresh: () => void;
}> = ({ tableName, rows, columns, onRefresh }) => {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const DB_API = `${API_URL}/admin/db`;

  const handleDelete = async (row: TableRow) => {
    if (!confirm("Delete this row?")) return;
    setDeleteError(null);
    try {
      const res = await fetch(`${DB_API}/tables/${tableName}/rows`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
      } else {
        setDeleteError(data.error || "Failed to delete row");
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete row");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
        No rows found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <span className="text-sm text-gray-600">{rows.length} row(s)</span>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          Refresh
        </button>
      </div>
      {deleteError && (
        <div className="p-4 bg-red-100 border-b border-red-400 text-red-700 text-sm">
          {deleteError}
          <button
            onClick={() => setDeleteError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  {col}
                </th>
              ))}
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 text-sm text-gray-700">
                    {row[col] !== null && row[col] !== undefined
                      ? String(row[col]).substring(0, 100)
                      : "NULL"}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDelete(row)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Structure Tab Component
const StructureTab: React.FC<{ structure: TableStructure[] }> = ({
  structure,
}) => {
  if (structure.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
        No structure data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
              Column
            </th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
              Type
            </th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
              Nullable
            </th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
              Default
            </th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
              Primary Key
            </th>
          </tr>
        </thead>
        <tbody>
          {structure.map((col, idx) => (
            <tr key={idx} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2 text-sm font-medium text-gray-700">
                {col.name}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">{col.type}</td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {col.nullable ? "Yes" : "No"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {col.default || "-"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {col.primary_key ? "✓" : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Insert Tab Component
const InsertTab: React.FC<{
  tableName: string;
  structure: TableStructure[];
  onInsert: () => void;
  onLoadStructure: () => void;
}> = ({ tableName, structure, onInsert, onLoadStructure }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [insertError, setInsertError] = useState<string | null>(null);
  const [insertSuccess, setInsertSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const DB_API = `${API_URL}/admin/db`;

  useEffect(() => {
    if (structure.length === 0) {
      onLoadStructure();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInsertError(null);
    setInsertSuccess(null);
    setIsSubmitting(true);
    
    try {
      const payload: Record<string, unknown> = {};
      structure.forEach((col) => {
        const value = formData[col.name];
        if (value !== undefined && value !== "") {
          // Try to parse as number if type suggests it
          if (col.type.includes("INT") || col.type.includes("FLOAT")) {
            payload[col.name] = Number(value);
          } else {
            payload[col.name] = value;
          }
        }
      });

      const res = await fetch(`${DB_API}/tables/${tableName}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setInsertSuccess(data.message || "Row inserted successfully");
        setFormData({});
        setTimeout(() => {
          onInsert();
        }, 1000);
      } else {
        setInsertError(data.error || "Failed to insert row");
      }
    } catch (e) {
      setInsertError(e instanceof Error ? e.message : "Failed to insert row");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Insert New Row</h2>
      {insertError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {insertError}
          <button
            onClick={() => setInsertError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}
      {insertSuccess && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
          {insertSuccess}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {structure.map((col) => (
          <div key={col.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {col.name}
              {col.primary_key && (
                <span className="text-red-600 ml-1">*</span>
              )}
              <span className="text-gray-500 text-xs ml-2">({col.type})</span>
            </label>
            <input
              type="text"
              value={formData[col.name] || ""}
              onChange={(e) =>
                setFormData({ ...formData, [col.name]: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={col.nullable ? "Optional" : "Required"}
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Inserting..." : "Insert Row"}
        </button>
      </form>
    </div>
  );
};

export default DatabaseAdmin;

