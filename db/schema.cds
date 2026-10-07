namespace my.company.leave;

entity Employees {
    key ID       : Integer;
    name         : String(100);
    email        : String(100);
    department   : String(50);
    jobTitle     : String(100);
}

entity LeaveRequests {
    key ID       : UUID;
    employee     : Association to Employees;
    leaveType    : String(50);
    fromDate     : Date;
    toDate       : Date;
    status       : String(20);
    reason       : String(255);
}
