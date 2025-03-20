import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContractState = {
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  nextExpenseId: 1,
  expenses: new Map(),
  participants: new Map(),
  payments: new Map(),
  totalAllocationPercentage: 0,
  blockHeight: 100
};

// Constants
const EXPENSE_EQUIPMENT = 1;
const EXPENSE_MAINTENANCE = 2;
const EXPENSE_BANDWIDTH = 3;
const EXPENSE_OTHER = 4;

const STATUS_PENDING = 1;
const STATUS_APPROVED = 2;
const STATUS_REJECTED = 3;
const STATUS_PAID = 4;

// Helper to create a unique key for the payments map
const createPaymentKey = (participant, expenseId) => `${participant}-${expenseId}`;

// Mock contract functions
const mockContract = {
  registerParticipant: (participant, name, allocationPercentage) => {
    const caller = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Simulating the tx-sender
    
    if (caller !== mockContractState.admin) {
      return { type: 'err', value: 403 };
    }
    
    // Check if allocation percentage is valid
    if (allocationPercentage > 10000) {
      return { type: 'err', value: 400 };
    }
    
    // Check if total allocation doesn't exceed 100%
    const newTotalAllocation = mockContractState.totalAllocationPercentage + allocationPercentage;
    if (newTotalAllocation > 10000) {
      return { type: 'err', value: 400 };
    }
    
    mockContractState.participants.set(participant, {
      name,
      allocationPercentage,
      joinedAt: mockContractState.blockHeight,
      active: true
    });
    
    mockContractState.totalAllocationPercentage = newTotalAllocation;
    
    return { type: 'ok', value: true };
  },
  
  submitExpense: (expenseType, amount, description) => {
    const caller = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Simulating the tx-sender
    
    if (caller !== mockContractState.admin) {
      return { type: 'err', value: 403 };
    }
    
    // Validate expense type
    if (![EXPENSE_EQUIPMENT, EXPENSE_MAINTENANCE, EXPENSE_BANDWIDTH, EXPENSE_OTHER].includes(expenseType)) {
      return { type: 'err', value: 400 };
    }
    
    const expenseId = mockContractState.nextExpenseId;
    
    mockContractState.expenses.set(expenseId, {
      expenseType,
      amount,
      description,
      createdBy: caller,
      createdAt: mockContractState.blockHeight,
      status: STATUS_PENDING,
      approvedBy: null,
      approvedAt: null
    });
    
    mockContractState.nextExpenseId += 1;
    
    return { type: 'ok', value: expenseId };
  },
  
  approveExpense: (expenseId) => {
    const caller = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Simulating the tx-sender
    
    if (caller !== mockContractState.admin) {
      return { type: 'err', value: 403 };
    }
    
    if (!mockContractState.expenses.has(expenseId)) {
      return { type: 'err', value: 404 };
    }
    
    const expenseData = mockContractState.expenses.get(expenseId);
    
    if (expenseData.status !== STATUS_PENDING) {
      return { type: 'err', value: 400 };
    }
    
    expenseData.status = STATUS_APPROVED;
    expenseData.approvedBy = caller;
    expenseData.approvedAt = mockContractState.blockHeight;
    
    mockContractState.expenses.set(expenseId, expenseData);
    
    return { type: 'ok', value: true };
  },
  
  recordPayment: (expenseId, participant) => {
    const caller = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Simulating the tx-sender
    
    if (caller !== mockContractState.admin && caller !== participant) {
      return { type: 'err', value: 403 };
    }
    
    if (!mockContractState.expenses.has(expenseId)) {
      return { type: 'err', value: 404 };
    }
    
    if (!mockContractState.participants.has(participant)) {
      return { type: 'err', value: 404 };
    }
    
    const expenseData = mockContractState.expenses.get(expenseId);
    const participantData = mockContractState.participants.get(participant);
    
    if (expenseData.status !== STATUS_APPROVED) {
      return { type: 'err', value: 400 };
    }
    
    // Calculate payment amount based on allocation percentage
    const paymentAmount = Math.floor((expenseData.amount * participantData.allocationPercentage) / 10000);
    
    const paymentKey = createPaymentKey(participant, expenseId);
    
    mockContractState.payments.set(paymentKey, {
      amount: paymentAmount,
      paidAt: mockContractState.blockHeight
    });
    
    return { type: 'ok', value: paymentAmount };
  },
  
  getExpense: (expenseId) => {
    if (!mockContractState.expenses.has(expenseId)) {
      return { type: 'none' };
    }
    
    return { type: 'some', value: mockContractState.expenses.get(expenseId) };
  },
  
  getParticipant: (participant) => {
    if (!mockContractState.participants.has(participant)) {
      return { type: 'none' };
    }
    
    return { type: 'some', value: mockContractState.participants.get(participant) };
  },
  
  getPayment: (participant, expenseId) => {
    const paymentKey = createPaymentKey(participant, expenseId);
    
    if (!mockContractState.payments.has(paymentKey)) {
      return { type: 'none' };
    }
    
    return { type: 'some', value: mockContractState.payments.get(paymentKey) };
  }
};

describe('Cost Sharing Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContractState.nextExpenseId = 1;
    mockContractState.expenses = new Map();
    mockContractState.participants = new Map();
    mockContractState.payments = new Map();
    mockContractState.totalAllocationPercentage = 0;
    mockContractState.blockHeight = 100;
  });
  
  it('should register a participant', () => {
    const participant = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const result = mockContract.registerParticipant(participant, 'John Doe', 5000); // 50%
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    expect(mockContractState.participants.has(participant)).toBe(true);
    
    const participantData = mockContractState.participants.get(participant);
    expect(participantData.name).toBe('John Doe');
    expect(participantData.allocationPercentage).toBe(5000);
    expect(participantData.active).toBe(true);
  });
  
  it('should reject participant registration if allocation exceeds 100%', () => {
    // First register a participant with 80%
    mockContract.registerParticipant('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', 'John Doe', 8000);
    
    // Try to register another with 30%
    const result = mockContract.registerParticipant('ST3NBRSFKX28FQ2ZJ5QJFN8KGQJE7RPVNNKSE7RV', 'Jane Smith', 3000);
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(400);
  });
  
  it('should submit an expense', () => {
    const result = mockContract.submitExpense(
        EXPENSE_EQUIPMENT,
        1000, // $10.00
        'New router purchase'
    );
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(1);
    expect(mockContractState.expenses.has(1)).toBe(true);
    
    const expenseData = mockContractState.expenses.get(1);
    expect(expenseData.expenseType).toBe(EXPENSE_EQUIPMENT);
    expect(expenseData.amount).toBe(1000);
    expect(expenseData.description).toBe('New router purchase');
    expect(expenseData.status).toBe(STATUS_PENDING);
  });
  
  it('should approve an expense', () => {
    // First submit an expense
    mockContract.submitExpense(EXPENSE_EQUIPMENT, 1000, 'New router purchase');
    
    // Then approve it
    const result = mockContract.approveExpense(1);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    
    const expenseData = mockContractState.expenses.get(1);
    expect(expenseData.status).toBe(STATUS_APPROVED);
    expect(expenseData.approvedBy).toBe('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
  });
  
  it('should record a payment', () => {
    const participant = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // Register participant
    mockContract.registerParticipant(participant, 'John Doe', 5000); // 50%
    
    // Submit expense
    mockContract.submitExpense(EXPENSE_EQUIPMENT, 1000, 'New router purchase');
    
    // Approve expense
    mockContract.approveExpense(1);
    
    // Record payment
    const result = mockContract.recordPayment(1, participant);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(500); // 50% of 1000
    
    const paymentKey = createPaymentKey(participant, 1);
    expect(mockContractState.payments.has(paymentKey)).toBe(true);
    
    const paymentData = mockContractState.payments.get(paymentKey);
    expect(paymentData.amount).toBe(500);
  });
  
  it('should reject payment for unapproved expense', () => {
    const participant = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // Register participant
    mockContract.registerParticipant(participant, 'John Doe', 5000); // 50%
    
    // Submit expense (but don't approve it)
    mockContract.submitExpense(EXPENSE_EQUIPMENT, 1000, 'New router purchase');
    
    // Try to record payment
    const result = mockContract.recordPayment(1, participant);
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(400);
  });
});
