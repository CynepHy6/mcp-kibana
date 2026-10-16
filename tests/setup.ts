const nock = require("nock");

process.env.KIBANA_BASE_URL = "https://kibana.example.com";
process.env.KIBANA_API_KEY = "test-api-key";

beforeEach(() => {
    nock.cleanAll();
});

afterEach(() => {
    nock.cleanAll();
});

// No real HTTP from tests
nock.disableNetConnect();
