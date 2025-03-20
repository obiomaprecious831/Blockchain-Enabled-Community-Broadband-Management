;; Cost Sharing Contract
;; Allocates expenses among participating households

(define-data-var admin principal tx-sender)

;; Expense types
(define-constant EXPENSE_EQUIPMENT u1)
(define-constant EXPENSE_MAINTENANCE u2)
(define-constant EXPENSE_BANDWIDTH u3)
(define-constant EXPENSE_OTHER u4)

;; Expense status
(define-constant STATUS_PENDING u1)
(define-constant STATUS_APPROVED u2)
(define-constant STATUS_REJECTED u3)
(define-constant STATUS_PAID u4)

;; Expense data structure
(define-map expenses
  { id: uint }
  {
    expense-type: uint,
    amount: uint,
    description: (string-ascii 256),
    created-by: principal,
    created-at: uint,
    status: uint,
    approved-by: (optional principal),
    approved-at: (optional uint)
  }
)

;; Participant data structure
(define-map participants
  { address: principal }
  {
    name: (string-ascii 64),
    allocation-percentage: uint, ;; out of 10000 (100.00%)
    joined-at: uint,
    active: bool
  }
)

;; Payment data structure
(define-map payments
  { participant: principal, expense-id: uint }
  {
    amount: uint,
    paid-at: uint
  }
)

(define-data-var next-expense-id uint u1)
(define-data-var total-allocation-percentage uint u0)

;; Register participant
(define-public (register-participant
    (participant principal)
    (name (string-ascii 64))
    (allocation-percentage uint)
  )
  (let
    (
      (current-time block-height)
      (new-total-allocation (+ (var-get total-allocation-percentage) allocation-percentage))
    )
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))

    ;; Check if allocation percentage is valid
    (asserts! (<= allocation-percentage u10000) (err u400))

    ;; Check if total allocation doesn't exceed 100%
    (asserts! (<= new-total-allocation u10000) (err u400))

    (map-set participants
      { address: participant }
      {
        name: name,
        allocation-percentage: allocation-percentage,
        joined-at: current-time,
        active: true
      }
    )
    (var-set total-allocation-percentage new-total-allocation)
    (ok true)
  )
)

;; Submit expense
(define-public (submit-expense
    (expense-type uint)
    (amount uint)
    (description (string-ascii 256))
  )
  (let
    (
      (expense-id (var-get next-expense-id))
      (current-time block-height)
    )
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))

    ;; Validate expense type
    (asserts! (or
      (is-eq expense-type EXPENSE_EQUIPMENT)
      (is-eq expense-type EXPENSE_MAINTENANCE)
      (is-eq expense-type EXPENSE_BANDWIDTH)
      (is-eq expense-type EXPENSE_OTHER)
    ) (err u400))

    (map-set expenses
      { id: expense-id }
      {
        expense-type: expense-type,
        amount: amount,
        description: description,
        created-by: tx-sender,
        created-at: current-time,
        status: STATUS_PENDING,
        approved-by: none,
        approved-at: none
      }
    )
    (var-set next-expense-id (+ expense-id u1))
    (ok expense-id)
  )
)

;; Approve expense
(define-public (approve-expense (expense-id uint))
  (let
    (
      (expense-data (unwrap! (map-get? expenses { id: expense-id }) (err u404)))
      (current-time block-height)
    )
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))
    (asserts! (is-eq (get status expense-data) STATUS_PENDING) (err u400))

    (map-set expenses
      { id: expense-id }
      (merge expense-data {
        status: STATUS_APPROVED,
        approved-by: (some tx-sender),
        approved-at: (some current-time)
      })
    )
    (ok true)
  )
)

;; Record payment for an expense
(define-public (record-payment (expense-id uint) (participant principal))
  (let
    (
      (expense-data (unwrap! (map-get? expenses { id: expense-id }) (err u404)))
      (participant-data (unwrap! (map-get? participants { address: participant }) (err u404)))
      (current-time block-height)
      (payment-amount (calculate-share (get amount expense-data) (get allocation-percentage participant-data)))
    )
    (asserts! (or (is-eq tx-sender (var-get admin)) (is-eq tx-sender participant)) (err u403))
    (asserts! (is-eq (get status expense-data) STATUS_APPROVED) (err u400))

    (map-set payments
      { participant: participant, expense-id: expense-id }
      {
        amount: payment-amount,
        paid-at: current-time
      }
    )

    (ok payment-amount)
  )
)

;; Calculate share based on allocation percentage
(define-private (calculate-share (amount uint) (allocation-percentage uint))
  (/ (* amount allocation-percentage) u10000)
)

;; Get expense details
(define-read-only (get-expense (expense-id uint))
  (map-get? expenses { id: expense-id })
)

;; Get participant details
(define-read-only (get-participant (participant principal))
  (map-get? participants { address: participant })
)

;; Get payment details
(define-read-only (get-payment (participant principal) (expense-id uint))
  (map-get? payments { participant: participant, expense-id: expense-id })
)

;; Update admin
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))
    (var-set admin new-admin)
    (ok true)
  )
)
