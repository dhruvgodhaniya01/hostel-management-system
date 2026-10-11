# Hostel Management System

A local-first, responsive hostel management application by **Dhruv Godhaniya**.

## Features
- Student admission
- Student full name with student mobile and parent mobile
- Admission date, fee start date, automatic fee end date and configurable fee duration (default 6 months)
- Caste selection with Maher as the default and custom caste support
- Automatic roll number allocation
- Permanent non-repeating Student ID
- Student search by roll number and other fields
- Student history
- Attendance
- Fees/payment history
- Hostel room/bed allocation
- Reports
- JSON export/import for PC ↔ mobile transfer
- LocalStorage persistence
- Desktop and mobile responsive UI

## Run
Open `index.html` directly in a modern browser, or use VS Code Live Server.

## Data
The database is stored in browser LocalStorage under:
`dhruv_hms_database_v1`

Use the built-in export/import system to transfer data between devices.


## Fee Deadline & Payment Improvements (v1.5)
- Fee payment now has its own editable payment date and payment method.
- Saving a fee keeps the selected student and refreshes the payment history immediately.
- Admission fee end date is automatically suggested from start date + duration, but can be manually edited.
- Fee deadline is visible in the Students page and selected-student area of Fees.
- Fees page includes an Expired Fee Students list with copy-to-clipboard and individual WhatsApp alert buttons.
- Expiry is based on the current date being after the saved fee ending date.


## v1.6 Student & Fee Management Improvements
- Expired-fee list is integrated with an **Add Fee** action that selects the student and opens the fee entry workflow.
- Fee entry now manages starting date, duration, and automatically calculated ending date.
- Student edit replaces the old direct **Mark Student Left** action and centralizes student data, room, fee period, attendance, fee navigation, leave/restore, and deletion.
- Fees page layout prevents the account history column from forcing unnecessary horizontal page scrolling.
