export interface Company {
  id: string
  name: string
  slug: string
  fiscal_year_start_month: number
  created_at: string
}

export interface ExpenseCategory {
  id: string
  company_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface DailySales {
  id: string
  company_id: string
  date: string
  pos_amount: number
  manual_amount: number
  memo: string | null
  updated_at: string
}

export interface DailyExpense {
  id: string
  company_id: string
  date: string
  category_id: string
  amount: number
  memo: string | null
  updated_at: string
}
