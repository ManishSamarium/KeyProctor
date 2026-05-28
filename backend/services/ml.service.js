const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

class MLService {
  async predict(features, username) {
    try {
      const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, {
        features, username
      });
      // Map confidence to status (threshold: 20% for Verified)
      const status = data.confidence >= 0.20 ? 'Verified'
                   : data.confidence >= 0.10 ? 'Warning' : 'Flagged';
      return { ...data, status };
    } catch (error) {
      console.error("ML Service Predict Error:", error.message);
      // Fallback
      return { confidence: 0, decision: false, status: 'Flagged' };
    }
  }

  async addSample(username, features) {
    // In a real implementation this would call the ML service to update the model or store features
    return { success: true };
  }

  async retrain(usersData) {
    try {
      const { data } = await axios.post(`${ML_SERVICE_URL}/retrain`, {
        users_data: usersData
      });
      return data;
    } catch (error) {
      console.error("ML Service Retrain Error:", error.message);
      return { status: "error" };
    }
  }

  async compile(code, stdin = '', timeout = 5) {
    try {
      const { data } = await axios.post(`${ML_SERVICE_URL}/compile`, {
        code, stdin, timeout
      });
      return data;
    } catch (error) {
      console.error('ML Service Compile Error:', error.message);
      return { stdout: '', stderr: 'Compilation service unavailable', compile_error: '', exit_code: -1, success: false };
    }
  }

  async grade(code, testCases, timeLimit = 5) {
    try {
      const { data } = await axios.post(`${ML_SERVICE_URL}/grade`, {
        code, test_cases: testCases, time_limit: timeLimit
      });
      return data;
    } catch (error) {
      console.error('ML Service Grade Error:', error.message);
      return { results: [], score: 0, max_score: 0, passed: 0, total: 0, compile_error: 'Grading service unavailable' };
    }
  }
}

module.exports = new MLService();
