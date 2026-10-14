import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const TOKEN_KEY = "payguard_access_token";
const USER_KEY = "payguard_user";

const INITIAL_FORM = {
  step: 10,
  type: "PAYMENT",
  amount: 500,
  oldbalanceOrg: 5000,
  newbalanceOrig: 4500,
  oldbalanceDest: 1000,
  newbalanceDest: 1500,
};

const DEMO_TRANSACTIONS = [
  {
    id: "demo-safe-1",
    transaction_id: "DEMO-SAFE-001",
    timestamp: "2026-10-05 10:30:00",
    transaction_type: "PAYMENT",
    amount: 500,
    prediction: "NOT FRAUD",
    fraud_probability: 2.15,
    risk_score: 2.15,
    risk_level: "LOW",
  },
  {
    id: "demo-fraud-1",
    transaction_id: "DEMO-FRAUD-001",
    timestamp: "2026-10-05 23:15:00",
    transaction_type: "CASH_OUT",
    amount: 185000,
    prediction: "FRAUD",
    fraud_probability: 94.50,
    risk_score: 94.50,
    risk_level: "HIGH",
  },
  {
    id: "demo-medium-1",
    transaction_id: "DEMO-MEDIUM-001",
    timestamp: "2026-10-06 14:20:00",
    transaction_type: "TRANSFER",
    amount: 42000,
    prediction: "NOT FRAUD",
    fraud_probability: 45.30,
    risk_score: 45.30,
    risk_level: "MEDIUM",
  },
  {
    id: "demo-safe-2",
    transaction_id: "DEMO-SAFE-002",
    timestamp: "2026-10-07 09:10:00",
    transaction_type: "PAYMENT",
    amount: 1250,
    prediction: "NOT FRAUD",
    fraud_probability: 2.10,
    risk_score: 2.10,
    risk_level: "LOW",
  },
  {
    id: "demo-fraud-2",
    transaction_id: "DEMO-FRAUD-002",
    timestamp: "2026-10-07 22:45:00",
    transaction_type: "TRANSFER",
    amount: 310000,
    prediction: "FRAUD",
    fraud_probability: 97.80,
    risk_score: 97.80,
    risk_level: "HIGH",
  },
  {
    id: "demo-safe-3",
    transaction_id: "DEMO-SAFE-003",
    timestamp: "2026-10-08 11:30:00",
    transaction_type: "CASH_IN",
    amount: 15000,
    prediction: "NOT FRAUD",
    fraud_probability: 0.50,
    risk_score: 0.50,
    risk_level: "LOW",
  },
  {
    id: "demo-safe-4",
    transaction_id: "DEMO-SAFE-004",
    timestamp: "2026-10-08 16:15:00",
    transaction_type: "DEBIT",
    amount: 4500,
    prediction: "NOT FRAUD",
    fraud_probability: 4.20,
    risk_score: 4.20,
    risk_level: "LOW",
  },
  {
    id: "demo-fraud-3",
    transaction_id: "DEMO-FRAUD-003",
    timestamp: "2026-10-09 01:05:00",
    transaction_type: "CASH_OUT",
    amount: 240000,
    prediction: "FRAUD",
    fraud_probability: 98.90,
    risk_score: 98.90,
    risk_level: "HIGH",
  },
];

function getStoredUser() {
  try {
    const savedUser = localStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data.detail || `Request failed with status ${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

function formatAmount(value) {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function mapTransaction(item) {
  return {
    id: item.id,
    transaction_id: item.transaction_id,
    timestamp: item.timestamp,
    step: item.step,
    transaction_type: item.transaction_type,
    amount: Number(item.amount || 0),
    prediction: item.prediction,
    fraud_probability: Number(item.fraud_probability || 0),
    risk_score: Number(item.risk_score || 0),
    risk_level: item.risk_level,
  };
}

function getRiskClass(riskLevel) {
  const level = String(riskLevel || "").toUpperCase();

  if (level === "HIGH") return "risk-high";
  if (level === "MEDIUM") return "risk-medium";

  return "risk-low";
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isRegister = mode === "register";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const switchMode = () => {
    setMode((previous) =>
      previous === "login" ? "register" : "login"
    );

    setForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const email = form.email.trim().toLowerCase();

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!form.password) {
      setError("Please enter your password.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (isRegister) {
      if (!form.name.trim()) {
        setError("Please enter your full name.");
        return;
      }

      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            email,
            password: form.password,
          }),
        });

        setSuccess("Account created successfully. Logging you in...");

        const loginData = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: form.password,
          }),
        });

        saveAuth(loginData.access_token, loginData.user);

        onAuthenticated(loginData.user);
      } else {
        const loginData = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password: form.password,
          }),
        });

        saveAuth(loginData.access_token, loginData.user);

        onAuthenticated(loginData.user);
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to connect to the PayGaurd AI server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      <div className="auth-container">
        <div className="auth-brand-panel">
          <div className="brand-mark large-mark">P</div>

          <div className="brand-name">PayGaurd AI</div>

          <h1>
            Intelligent
            <br />
            Fraud Detection
          </h1>

          <p>
            Analyze financial transactions using machine learning,
            risk scoring and real-time fraud detection.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span>✓</span>
              <div>
                <strong>AI-Powered Detection</strong>
                <small>Random Forest fraud classification</small>
              </div>
            </div>

            <div className="auth-feature">
              <span>✓</span>
              <div>
                <strong>Risk Scoring</strong>
                <small>Transaction-level risk analysis</small>
              </div>
            </div>

            <div className="auth-feature">
              <span>✓</span>
              <div>
                <strong>Secure Dashboard</strong>
                <small>JWT authenticated transaction history</small>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-wrapper">
            <div className="mobile-brand">
              <div className="brand-mark">P</div>
              <span>PayGaurd AI</span>
            </div>

            <div className="auth-heading">
              <span className="eyebrow">
                {isRegister ? "GET STARTED" : "WELCOME BACK"}
              </span>

              <h2>
                {isRegister
                  ? "Create your account"
                  : "Sign in to your account"}
              </h2>

              <p>
                {isRegister
                  ? "Create a secure account to access PayGaurd AI."
                  : "Continue to your fraud detection dashboard."}
              </p>
            </div>

            {error && (
              <div className="alert alert-error">
                <span>!</span>
                <div>{error}</div>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <span>✓</span>
                <div>{success}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {isRegister && (
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={handleChange}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                />
              </div>

              {isRegister && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">
                    Confirm Password
                  </label>

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <button
                className="primary-button auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isRegister
                  ? "Create Account"
                  : "Sign In"}

                {!loading && <span>→</span>}
              </button>
            </form>

            <div className="auth-switch">
              <span>
                {isRegister
                  ? "Already have an account?"
                  : "Don't have an account?"}
              </span>

              <button type="button" onClick={switchMode}>
                {isRegister ? "Sign In" : "Create Account"}
              </button>
            </div>

            <div className="auth-security-note">
              <span>🔒</span>
              <span>
                Your account is protected with secure password
                hashing and JWT authentication.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon,
  className = "",
}) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-top">
        <div className="stat-icon">{icon}</div>
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-label">{label}</div>

      {helper && <div className="stat-helper">{helper}</div>}
    </div>
  );
}

function StatusBadge({ children, type = "success" }) {
  return (
    <span className={`status-badge status-${type}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}

function DashboardOverview({
  transactions,
  apiStatus,
  modelStatus,
  databaseStatus,
  onAnalyze,
  onSeedData,
}) {
  const stats = useMemo(() => {
    const totalTransactions = transactions.length;

    const fraudTransactions = transactions.filter(
      (transaction) =>
        String(transaction.prediction).toUpperCase() === "FRAUD"
    ).length;

    const safeTransactions =
      totalTransactions - fraudTransactions;

    const highRisk = transactions.filter(
      (transaction) =>
        String(transaction.risk_level).toUpperCase() === "HIGH"
    ).length;

    const totalAmount = transactions.reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount || 0),
      0
    );

    const averageRisk =
      totalTransactions > 0
        ? transactions.reduce(
            (sum, transaction) =>
              sum + Number(transaction.risk_score || 0),
            0
          ) / totalTransactions
        : 0;

    const fraudRate =
      totalTransactions > 0
        ? (fraudTransactions / totalTransactions) * 100
        : 0;

    return {
      totalTransactions,
      fraudTransactions,
      safeTransactions,
      highRisk,
      totalAmount,
      averageRisk,
      fraudRate,
    };
  }, [transactions]);

  const fraudChartData = [
    {
      name: "Safe",
      value: stats.safeTransactions,
    },
    {
      name: "Fraud",
      value: stats.fraudTransactions,
    },
  ];

  const transactionTypeData = useMemo(() => {
    const counts = {};

    transactions.forEach((transaction) => {
      const type = transaction.transaction_type || "UNKNOWN";

      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [transactions]);

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="dashboard-content">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>
            Monitor your financial transactions and fraud risk.
          </p>
        </div>

        <div className="button-group">
          <button className="secondary-button" onClick={onSeedData}>
            ⚡ Seed Dummy Data
          </button>
          <button className="primary-button" onClick={onAnalyze}>
            Analyze Transaction
            <span>→</span>
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Transactions"
          value={stats.totalTransactions}
          helper="Analyzed transactions"
          icon="↗"
        />

        <StatCard
          label="Fraud Detected"
          value={stats.fraudTransactions}
          helper={`${stats.fraudRate.toFixed(1)}% fraud rate`}
          icon="⚠"
          className="stat-danger"
        />

        <StatCard
          label="Safe Transactions"
          value={stats.safeTransactions}
          helper="Low-risk transactions"
          icon="✓"
          className="stat-success"
        />

        <StatCard
          label="High Risk"
          value={stats.highRisk}
          helper="Requires attention"
          icon="!"
          className="stat-warning"
        />

        <StatCard
          label="Average Risk"
          value={formatPercent(stats.averageRisk)}
          helper="Average risk score"
          icon="%"
        />

        <StatCard
          label="Total Amount"
          value={formatAmount(stats.totalAmount)}
          helper="Amount analyzed"
          icon="₹"
        />
      </div>

      <div className="status-strip">
        <div className="status-strip-title">
          <span>System Status</span>
          <small>Live service health</small>
        </div>

        <StatusBadge
          type={apiStatus ? "success" : "error"}
        >
          API {apiStatus ? "Online" : "Offline"}
        </StatusBadge>

        <StatusBadge
          type={modelStatus ? "success" : "error"}
        >
          Model {modelStatus ? "Loaded" : "Unavailable"}
        </StatusBadge>

        <StatusBadge
          type={databaseStatus ? "success" : "error"}
        >
          Database {databaseStatus ? "Connected" : "Unavailable"}
        </StatusBadge>
      </div>

      <div className="charts-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Safe vs Fraud</h2>
              <p>Transaction classification</p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-chart">
              <div className="empty-icon">◌</div>
              <h3>No transactions yet</h3>
              <p>
                Analyze your first transaction to populate
                this chart.
              </p>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={fraudChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={55}
                    paddingAngle={4}
                    label={({ name, value }) =>
                      `${name}: ${value}`
                    }
                  >
                    {fraudChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "Fraud"
                            ? "#ef4444"
                            : "#22c55e"
                        }
                      />
                    ))}
                  </Pie>

                  <Tooltip />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Transaction Types</h2>
              <p>Activity by transaction type</p>
            </div>
          </div>

          {transactionTypeData.length === 0 ? (
            <div className="empty-chart">
              <div className="empty-icon">◌</div>
              <h3>No transaction data</h3>
              <p>
                Transaction types will appear after analysis.
              </p>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={transactionTypeData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: -15,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="count"
                    name="Transactions"
                    fill="#6366f1"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading panel-heading-with-action">
          <div>
            <h2>Recent Transactions</h2>
            <p>Latest activity from your account</p>
          </div>

          <span className="record-count">
            {transactions.length} records
          </span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">↗</div>
            <h3>No transactions available</h3>
            <p>
              Start by analyzing a transaction using the
              Analyze Transaction button.
            </p>

            <button
              className="secondary-button"
              onClick={onAnalyze}
            >
              Analyze Transaction
            </button>
          </div>
        ) : (
          <TransactionTable
            transactions={recentTransactions}
            compact
          />
        )}
      </div>
    </div>
  );
}

function TransactionTable({
  transactions,
  compact = false,
}) {
  if (!transactions.length) {
    return (
      <div className="empty-state small-empty">
        <div className="empty-icon">⌕</div>
        <h3>No transactions found</h3>
        <p>Try changing your filters.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="transaction-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Prediction</th>
            <th>Probability</th>
            <th>Risk</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id || transaction.transaction_id}>
              <td>
                <div className="transaction-id">
                  {transaction.transaction_id}
                </div>
              </td>

              <td>
                <span className="date-text">
                  {formatDate(transaction.timestamp)}
                </span>
              </td>

              <td>
                <span className="type-badge">
                  {transaction.transaction_type}
                </span>
              </td>

              <td>
                <strong>
                  {formatAmount(transaction.amount)}
                </strong>
              </td>

              <td>
                <span
                  className={`prediction-badge ${
                    String(transaction.prediction).toUpperCase() ===
                    "FRAUD"
                      ? "prediction-fraud"
                      : "prediction-safe"
                  }`}
                >
                  {String(transaction.prediction).toUpperCase() ===
                  "FRAUD"
                    ? "FRAUD"
                    : "SAFE"}
                </span>
              </td>

              <td>
                {formatPercent(transaction.fraud_probability)}
              </td>

              <td>
                <span
                  className={`risk-badge ${getRiskClass(
                    transaction.risk_level
                  )}`}
                >
                  {transaction.risk_level}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {compact && transactions.length >= 5 && (
        <div className="table-footer-note">
          Showing the latest 5 transactions
        </div>
      )}
    </div>
  );
}

function AnalyzeTransaction({
  form,
  setForm,
  loading,
  result,
  onSubmit,
  onUseDemo,
}) {
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        name === "type"
          ? value
          : value === ""
          ? ""
          : Number(value),
    }));
  };

  return (
    <div className="dashboard-content">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">AI ANALYSIS</span>
          <h1>Analyze Transaction</h1>
          <p>
            Submit transaction details to calculate fraud
            probability and risk.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={onUseDemo}
        >
          Use Demo Data
        </button>
      </div>

      <div className="analysis-layout">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Transaction Details</h2>
              <p>Enter the financial transaction data.</p>
            </div>
          </div>

          <form
            className="transaction-form"
            onSubmit={onSubmit}
          >
            <div className="form-grid">
              <div className="form-group">
                <label>Step</label>

                <input
                  type="number"
                  name="step"
                  min="0"
                  value={form.step}
                  onChange={handleChange}
                />

                <small>
                  Time step in the PaySim dataset.
                </small>
              </div>

              <div className="form-group">
                <label>Transaction Type</label>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                >
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="CASH_OUT">CASH_OUT</option>
                  <option value="CASH_IN">CASH_IN</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="DEBIT">DEBIT</option>
                </select>
              </div>

              <div className="form-group">
                <label>Amount</label>

                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Sender Old Balance</label>

                <input
                  type="number"
                  name="oldbalanceOrg"
                  min="0"
                  step="0.01"
                  value={form.oldbalanceOrg}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Sender New Balance</label>

                <input
                  type="number"
                  name="newbalanceOrig"
                  min="0"
                  step="0.01"
                  value={form.newbalanceOrig}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Receiver Old Balance</label>

                <input
                  type="number"
                  name="oldbalanceDest"
                  min="0"
                  step="0.01"
                  value={form.oldbalanceDest}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Receiver New Balance</label>

                <input
                  type="number"
                  name="newbalanceDest"
                  min="0"
                  step="0.01"
                  value={form.newbalanceDest}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-submit-row">
              <div className="form-security-note">
                <span>🛡</span>
                <span>
                  Your transaction is analyzed by the trained
                  fraud detection model.
                </span>
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Analyzing..."
                  : "Analyze Transaction"}
                {!loading && <span>→</span>}
              </button>
            </div>
          </form>
        </div>

        {result && (
          <div className="panel prediction-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ANALYSIS RESULT</span>
                <h2>Fraud Detection Result</h2>
              </div>
            </div>

            <div
              className={`prediction-main ${
                String(result.prediction).toUpperCase() ===
                "FRAUD"
                  ? "result-fraud"
                  : "result-safe"
              }`}
            >
              <div className="result-icon">
                {String(result.prediction).toUpperCase() ===
                "FRAUD"
                  ? "!"
                  : "✓"}
              </div>

              <div>
                <span className="result-label">
                  Prediction
                </span>

                <strong>
                  {String(result.prediction).toUpperCase()}
                </strong>
              </div>
            </div>

            <div className="result-metrics">
              <div className="result-metric">
                <span>Fraud Probability</span>
                <strong>
                  {formatPercent(result.fraud_probability)}
                </strong>
              </div>

              <div className="result-metric">
                <span>Risk Score</span>
                <strong>
                  {formatPercent(result.risk_score)}
                </strong>
              </div>

              <div className="result-metric">
                <span>Risk Level</span>
                <strong
                  className={getRiskClass(result.risk_level)}
                >
                  {result.risk_level}
                </strong>
              </div>
            </div>

            <div className="risk-meter">
              <div className="risk-meter-header">
                <span>Risk Level</span>
                <strong>
                  {formatPercent(result.risk_score)}
                </strong>
              </div>

              <div className="risk-meter-track">
                <div
                  className={`risk-meter-fill ${getRiskClass(
                    result.risk_level
                  )}`}
                  style={{
                    width: `${Math.min(
                      Math.max(Number(result.risk_score || 0), 0),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="result-transaction-id">
              <span>Transaction ID</span>
              <strong>{result.transaction_id}</strong>
            </div>

            <div className="result-note">
              <strong>Important:</strong> This model is trained
              on the PaySim synthetic transaction dataset and
              is intended for demonstration and portfolio use.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionsPage({
  transactions,
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  predictionFilter,
  setPredictionFilter,
  typeFilter,
  setTypeFilter,
  onExport,
  onSeedData,
}) {
  const transactionTypes = useMemo(() => {
    const types = new Set();

    transactions.forEach((transaction) => {
      if (transaction.transaction_type) {
        types.add(transaction.transaction_type);
      }
    });

    return Array.from(types).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        String(transaction.transaction_id)
          .toLowerCase()
          .includes(searchValue) ||
        String(transaction.transaction_type)
          .toLowerCase()
          .includes(searchValue);

      const matchesRisk =
        riskFilter === "ALL" ||
        String(transaction.risk_level).toUpperCase() ===
          riskFilter;

      const matchesPrediction =
        predictionFilter === "ALL" ||
        String(transaction.prediction).toUpperCase() ===
          predictionFilter;

      const matchesType =
        typeFilter === "ALL" ||
        transaction.transaction_type === typeFilter;

      return (
        matchesSearch &&
        matchesRisk &&
        matchesPrediction &&
        matchesType
      );
    });
  }, [
    transactions,
    search,
    riskFilter,
    predictionFilter,
    typeFilter,
  ]);

  return (
    <div className="dashboard-content">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">TRANSACTION HISTORY</span>
          <h1>Transactions</h1>
          <p>
            Search, filter and export your analyzed transactions.
          </p>
        </div>

        <div className="button-group">
          <button className="secondary-button" onClick={onSeedData}>
            ⚡ Seed Dummy Data
          </button>
          <button
            className="secondary-button"
            onClick={onExport}
            disabled={!filteredTransactions.length}
          >
            Export CSV
            <span>↓</span>
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="filter-toolbar">
          <div className="search-box">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search transaction ID or type..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(event.target.value)
            }
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk</option>
          </select>

          <select
            value={predictionFilter}
            onChange={(event) =>
              setPredictionFilter(event.target.value)
            }
          >
            <option value="ALL">All Predictions</option>
            <option value="FRAUD">Fraud</option>
            <option value="NOT FRAUD">Safe</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            <option value="ALL">All Types</option>

            {transactionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-result-count">
          Showing {filteredTransactions.length} of{" "}
          {transactions.length} transactions
        </div>

        <TransactionTable transactions={filteredTransactions} />
      </div>
    </div>
  );
}

function AnalyticsPage({ transactions }) {
  const analytics = useMemo(() => {
    const riskCounts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    const typeCounts = {};

    transactions.forEach((transaction) => {
      const risk = String(
        transaction.risk_level || "LOW"
      ).toUpperCase();

      if (riskCounts[risk] !== undefined) {
        riskCounts[risk] += 1;
      }

      const type =
        transaction.transaction_type || "UNKNOWN";

      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return {
      riskData: [
        {
          name: "Low",
          value: riskCounts.LOW,
        },
        {
          name: "Medium",
          value: riskCounts.MEDIUM,
        },
        {
          name: "High",
          value: riskCounts.HIGH,
        },
      ],
      typeData: Object.entries(typeCounts)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort((a, b) => b.value - a.value),
    };
  }, [transactions]);

  const total = transactions.length;

  return (
    <div className="dashboard-content">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">ANALYTICS</span>
          <h1>Analytics</h1>
          <p>
            Understand patterns across your analyzed
            transactions.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="panel empty-state">
          <div className="empty-icon">◌</div>

          <h3>No analytics data yet</h3>

          <p>
            Analyze transactions to start building your
            analytics dashboard.
          </p>
        </div>
      ) : (
        <div className="charts-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Risk Distribution</h2>
                <p>Low, medium and high-risk transactions</p>
              </div>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={analytics.riskData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={60}
                    label={({ name, value }) =>
                      `${name}: ${value}`
                    }
                  >
                    {analytics.riskData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "High"
                            ? "#ef4444"
                            : entry.name === "Medium"
                            ? "#f59e0b"
                            : "#22c55e"
                        }
                      />
                    ))}
                  </Pie>

                  <Tooltip />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Transaction Activity</h2>
                <p>Number of transactions by type</p>
              </div>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={analytics.typeData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: -10,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="value"
                    name="Transactions"
                    fill="#6366f1"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(getStoredUser);

  const [activePage, setActivePage] = useState("overview");

  const [transactions, setTransactions] = useState([]);

  const [form, setForm] = useState(INITIAL_FORM);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [apiStatus, setApiStatus] = useState(false);
  const [modelStatus, setModelStatus] = useState(false);
  const [databaseStatus, setDatabaseStatus] =
    useState(false);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [predictionFilter, setPredictionFilter] =
    useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setTransactions([]);
    setResult(null);
    setActivePage("overview");
  }, []);

  const checkApiHealth = useCallback(async () => {
    try {
      const data = await apiRequest("/health");

      setApiStatus(data.status === "healthy");
      setModelStatus(Boolean(data.model_loaded));
      setDatabaseStatus(Boolean(data.database_connected));

      return data;
    } catch {
      setApiStatus(false);
      setModelStatus(false);
      setDatabaseStatus(false);

      return null;
    }
  }, []);

  const loadTransactionHistory = useCallback(async () => {
    try {
      const data = await apiRequest("/transactions");

      let rawList = [];
      if (Array.isArray(data)) {
        rawList = data;
      } else if (data && Array.isArray(data.transactions)) {
        rawList = data.transactions;
      }

      if (rawList.length === 0) {
        rawList = DEMO_TRANSACTIONS;
      }

      const mapped = rawList.map(mapTransaction);
      setTransactions(mapped);
    } catch (error) {
      if (error.status === 401) {
        logout();
        return;
      }

      console.error("Unable to load transactions, using fallback demo data:", error);
      setTransactions(DEMO_TRANSACTIONS.map(mapTransaction));
    }
  }, [logout]);

  const handleSeedData = async () => {
    try {
      setLoading(true);
      await apiRequest("/transactions/seed", { method: "POST" });
      await loadTransactionHistory();
    } catch (error) {
      console.error("Seed error:", error);
      setTransactions(DEMO_TRANSACTIONS.map(mapTransaction));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    checkApiHealth();
    loadTransactionHistory();

    const interval = setInterval(() => {
      checkApiHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, checkApiHealth, loadTransactionHistory]);

  const handleAuthenticated = (authenticatedUser) => {
    setUser(authenticatedUser);
    setActivePage("overview");
  };

  const handleSubmitPrediction = async (event) => {
    event.preventDefault();

    setLoading(true);
    setResult(null);

    try {
      const payload = {
        step: Number(form.step),
        amount: Number(form.amount),
        oldbalanceOrg: Number(form.oldbalanceOrg),
        newbalanceOrig: Number(form.newbalanceOrig),
        oldbalanceDest: Number(form.oldbalanceDest),
        newbalanceDest: Number(form.newbalanceDest),
        type: form.type,
      };

      const data = await apiRequest("/predict", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setResult(data);

      await loadTransactionHistory();

      setActivePage("analyze");
    } catch (error) {
      if (error.status === 401) {
        logout();
        return;
      }

      alert(
        error.message ||
          "Unable to analyze this transaction."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemo = () => {
    setForm({
      step: 10,
      type: "PAYMENT",
      amount: 500,
      oldbalanceOrg: 5000,
      newbalanceOrig: 4500,
      oldbalanceDest: 1000,
      newbalanceDest: 1500,
    });

    setResult(null);
  };

  const exportCSV = () => {
    if (!transactions.length) return;

    const filtered = transactions.filter((transaction) => {
      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        String(transaction.transaction_id)
          .toLowerCase()
          .includes(searchValue) ||
        String(transaction.transaction_type)
          .toLowerCase()
          .includes(searchValue);

      const matchesRisk =
        riskFilter === "ALL" ||
        String(transaction.risk_level).toUpperCase() ===
          riskFilter;

      const matchesPrediction =
        predictionFilter === "ALL" ||
        String(transaction.prediction).toUpperCase() ===
          predictionFilter;

      const matchesType =
        typeFilter === "ALL" ||
        transaction.transaction_type === typeFilter;

      return (
        matchesSearch &&
        matchesRisk &&
        matchesPrediction &&
        matchesType
      );
    });

    const headers = [
      "Transaction ID",
      "Timestamp",
      "Transaction Type",
      "Amount",
      "Prediction",
      "Fraud Probability (%)",
      "Risk Score (%)",
      "Risk Level",
    ];

    const rows = filtered.map((transaction) => [
      transaction.transaction_id,
      transaction.timestamp,
      transaction.transaction_type,
      transaction.amount,
      transaction.prediction,
      transaction.fraud_probability,
      transaction.risk_score,
      transaction.risk_level,
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const stringValue = String(value ?? "");

            return `"${stringValue.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `payguard_transactions_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const navigate = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);

    if (page !== "analyze") {
      setResult(null);
    }
  };

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${
          mobileMenuOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">P</div>

          <div>
            <strong>PayGaurd</strong>
            <span>AI</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">
            MAIN MENU
          </div>

          <button
            className={`nav-item ${
              activePage === "overview" ? "active" : ""
            }`}
            onClick={() => navigate("overview")}
          >
            <span className="nav-icon">⌂</span>
            <span>Overview</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "analyze" ? "active" : ""
            }`}
            onClick={() => navigate("analyze")}
          >
            <span className="nav-icon">✦</span>
            <span>Analyze</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "transactions"
                ? "active"
                : ""
            }`}
            onClick={() => navigate("transactions")}
          >
            <span className="nav-icon">▤</span>
            <span>Transactions</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "analytics" ? "active" : ""
            }`}
            onClick={() => navigate("analytics")}
          >
            <span className="nav-icon">◈</span>
            <span>Analytics</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-model-card">
            <div className="model-status-icon">✓</div>

            <div>
              <strong>AI Model</strong>
              <span>
                {modelStatus ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <button className="logout-button" onClick={logout}>
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen((previous) => !previous)
            }
          >
            ☰
          </button>

          <div className="topbar-title">
            <span>Fraud Intelligence Platform</span>
          </div>

          <div className="topbar-right">
            <div className="topbar-status">
              <span
                className={`live-dot ${
                  apiStatus ? "online" : ""
                }`}
              />

              {apiStatus ? "System Online" : "System Offline"}
            </div>

            <div className="user-menu">
              <div className="user-avatar">
                {String(user.name || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="user-details">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </div>
          </div>
        </header>

        {activePage === "overview" && (
          <DashboardOverview
            transactions={transactions}
            apiStatus={apiStatus}
            modelStatus={modelStatus}
            databaseStatus={databaseStatus}
            onAnalyze={() => navigate("analyze")}
            onSeedData={handleSeedData}
          />
        )}

        {activePage === "analyze" && (
          <AnalyzeTransaction
            form={form}
            setForm={setForm}
            loading={loading}
            result={result}
            onSubmit={handleSubmitPrediction}
            onUseDemo={handleUseDemo}
          />
        )}

        {activePage === "transactions" && (
          <TransactionsPage
            transactions={transactions}
            search={search}
            setSearch={setSearch}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            predictionFilter={predictionFilter}
            setPredictionFilter={setPredictionFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            onExport={exportCSV}
            onSeedData={handleSeedData}
          />
        )}

        {activePage === "analytics" && (
          <AnalyticsPage transactions={transactions} />
        )}
      </main>
    </div>
  );
}

export default App;