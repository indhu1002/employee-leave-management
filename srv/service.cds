using my.company.leave as my from '../db/schema';

service LeaveService {
    @readonly
    entity Employees as projection on my.Employees;
    entity LeaveRequests as projection on my.LeaveRequests;
}
