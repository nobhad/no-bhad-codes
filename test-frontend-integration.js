/**
 * Frontend Integration Test Script
 * Run this in the browser console at http://localhost:5173/test-intake.html
 */

console.log('🧪 Testing Frontend Integration...');

// Test data
const testFormData = {
  name: 'Test User',
  email: 'test@example.com',
  company: 'Test Company',
  phone: '555-0123',
  projectType: 'web-app',
  description: 'Testing the frontend integration',
  timeline: '1-3-months',
  budget: '25k-50k',
  features: ['user-auth', 'dashboard'],
};

// Function to test API connectivity
async function testAPIConnectivity() {
  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    console.log('✅ Backend API is reachable:', data);
    return true;
  } catch (error) {
    console.error('❌ Backend API is not reachable:', error);
    return false;
  }
}

// Function to test form submission
async function testFormSubmission() {
  try {
    console.log('📝 Testing form submission...');

    const response = await fetch('http://localhost:3001/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testFormData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Form submission successful:', result);
    return result;
  } catch (error) {
    console.error('❌ Form submission failed:', error);
    return null;
  }
}

// Function to run all tests
async function runIntegrationTests() {
  console.log('🚀 Starting Frontend Integration Tests...');
  console.log('=====================================');

  // Test 1: API Connectivity
  const apiReachable = await testAPIConnectivity();
  if (!apiReachable) {
    console.log('❌ Integration tests failed - API not reachable');
    return;
  }

  // Test 2: Form Submission
  const submissionResult = await testFormSubmission();
  if (!submissionResult) {
    console.log('❌ Integration tests failed - Form submission failed');
    return;
  }

  console.log('🎉 All Integration Tests Passed!');
  console.log('================================');
  console.log('✅ Backend connectivity: WORKING');
  console.log('✅ CORS configuration: WORKING');
  console.log('✅ Form data submission: WORKING');
  console.log('✅ JSON serialization: WORKING');
  console.log(`✅ Intake ID created: ${submissionResult.intake?.id}`);
  console.log('');
  console.log('🚀 Frontend is fully integrated with backend!');
}

// Auto-run tests
runIntegrationTests();

// Export for manual testing
window.testIntegration = {
  runTests: runIntegrationTests,
  testAPI: testAPIConnectivity,
  testForm: testFormSubmission,
  testData: testFormData,
};
