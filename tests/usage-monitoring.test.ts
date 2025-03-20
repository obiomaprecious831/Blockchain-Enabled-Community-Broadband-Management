import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity contract environment
const mockContractState = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  bandwidthUsage: new Map(),
}

// Helper to create a unique key for the bandwidth usage map
const createUsageKey = (user, month, year) => `${user}-${month}-${year}`

// Mock contract functions
const mockContract = {
  recordUsage: (user, month, year, downloadGb, uploadGb) => {
    const caller = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Simulating the tx-sender
    const currentTime = Math.floor(Date.now() / 1000)
    
    if (caller !== mockContractState.admin) {
      return { type: "err", value: 403 }
    }
    
    // Validate month
    if (month < 1 || month > 12) {
      return { type: "err", value: 400 }
    }
    
    const key = createUsageKey(user, month, year)
    const existingData = mockContractState.bandwidthUsage.get(key)
    
    if (existingData) {
      // Update existing record
      mockContractState.bandwidthUsage.set(key, {
        downloadGb: existingData.downloadGb + downloadGb,
        uploadGb: existingData.uploadGb + uploadGb,
        lastUpdated: currentTime,
      })
    } else {
      // Create new record
      mockContractState.bandwidthUsage.set(key, {
        downloadGb,
        uploadGb,
        lastUpdated: currentTime,
      })
    }
    
    return { type: "ok", value: true }
  },
  
  getUsage: (user, month, year) => {
    const key = createUsageKey(user, month, year)
    const usageData = mockContractState.bandwidthUsage.get(key)
    
    if (!usageData) {
      return { type: "none" }
    }
    
    return { type: "some", value: usageData }
  },
  
  exceededThreshold: (user, month, year, thresholdGb) => {
    const key = createUsageKey(user, month, year)
    const usageData = mockContractState.bandwidthUsage.get(key)
    
    if (!usageData) {
      return false
    }
    
    const totalUsage = usageData.downloadGb + usageData.uploadGb
    return totalUsage > thresholdGb
  },
}

describe("Usage Monitoring Contract", () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContractState.bandwidthUsage = new Map()
  })
  
  it("should record new usage data", () => {
    const user = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    const result = mockContract.recordUsage(user, 5, 2023, 100, 20)
    
    expect(result.type).toBe("ok")
    expect(result.value).toBe(true)
    
    const key = createUsageKey(user, 5, 2023)
    expect(mockContractState.bandwidthUsage.has(key)).toBe(true)
    
    const usageData = mockContractState.bandwidthUsage.get(key)
    expect(usageData.downloadGb).toBe(100)
    expect(usageData.uploadGb).toBe(20)
  })
  
  it("should update existing usage data", () => {
    const user = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    // First record
    mockContract.recordUsage(user, 5, 2023, 100, 20)
    
    // Second record for the same user/month/year
    const result = mockContract.recordUsage(user, 5, 2023, 50, 10)
    
    expect(result.type).toBe("ok")
    expect(result.value).toBe(true)
    
    const key = createUsageKey(user, 5, 2023)
    const usageData = mockContractState.bandwidthUsage.get(key)
    expect(usageData.downloadGb).toBe(150) // 100 + 50
    expect(usageData.uploadGb).toBe(30) // 20 + 10
  })
  
  it("should reject invalid month values", () => {
    const user = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    // Try with month = 0
    let result = mockContract.recordUsage(user, 0, 2023, 100, 20)
    expect(result.type).toBe("err")
    expect(result.value).toBe(400)
    
    // Try with month = 13
    result = mockContract.recordUsage(user, 13, 2023, 100, 20)
    expect(result.type).toBe("err")
    expect(result.value).toBe(400)
  })
  
  it("should return usage data for a user", () => {
    const user = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    // Record usage
    mockContract.recordUsage(user, 5, 2023, 100, 20)
    
    // Get usage
    const result = mockContract.getUsage(user, 5, 2023)
    
    expect(result.type).toBe("some")
    expect(result.value.downloadGb).toBe(100)
    expect(result.value.uploadGb).toBe(20)
  })
  
  it("should return none for non-existent usage data", () => {
    const user = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    // Get usage for data that doesn't exist
    const result = mockContract.getUsage(user, 6, 2023)
    
    expect(result.type).toBe("none")
  })
  
  it("should correctly determine if threshold is exceeded", () => {
    const user = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    // Record usage
    mockContract.recordUsage(user, 5, 2023, 80, 30) // Total: 110 GB
    
    // Check threshold
    expect(mockContract.exceededThreshold(user, 5, 2023, 100)).toBe(true)
    expect(mockContract.exceededThreshold(user, 5, 2023, 150)).toBe(false)
  })
})

