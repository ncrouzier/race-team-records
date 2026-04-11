import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UsersService } from '../../../core/services/users.service';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { UserAddModalComponent } from '../modals/user-add-modal.component';
import { UserEditModalComponent } from '../modals/user-edit-modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe, UserAddModalComponent, UserEditModalComponent],
  template: `
<div class="jumbotron">
  <h2><i class="fa fa-users"></i> Users</h2>
  <div class="row" style="margin-bottom: 15px;">
    <div class="col-md-3">
      <select class="form-control" [(ngModel)]="roleFilter" (ngModelChange)="updateFilteredUsers()">
        <option *ngFor="let role of rolesList" [value]="role">{{role}}</option>
      </select>
    </div>
    <div class="col-md-5">
      <input type="text" class="form-control" placeholder="Search..." [(ngModel)]="searchQuery" (ngModelChange)="updateFilteredUsers()">
    </div>
    <div class="col-md-4 text-right">
      <button class="btn btn-primary" (click)="addUser()"><i class="fa fa-plus"></i> Add User</button>
    </div>
  </div>
  <table class="table table-striped table-hover">
    <thead>
      <tr>
        <th class="hoverhand" (click)="setSortBy('username')">Username <i class="fa" [ngClass]="getSortIcon('username')"></i></th>
        <th class="hoverhand" (click)="setSortBy('email')">Email <i class="fa" [ngClass]="getSortIcon('email')"></i></th>
        <th class="hoverhand" (click)="setSortBy('role')">Role <i class="fa" [ngClass]="getSortIcon('role')"></i></th>
        <th>Member</th>
        <th class="hoverhand" (click)="setSortBy('enabled')">Status <i class="fa" [ngClass]="getSortIcon('enabled')"></i></th>
        <th class="hoverhand" (click)="setSortBy('lastLogin')">Last Login <i class="fa" [ngClass]="getSortIcon('lastLogin')"></i></th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let u of filteredAndSortedUsers">
        <td>{{u.username}}</td>
        <td>{{u.email}}</td>
        <td><span class="label" [ngClass]="{'label-danger': u.role === 'admin', 'label-warning': u.role === 'captain', 'label-default': u.role === 'user'}">{{u.role}}</span></td>
        <td><a *ngIf="u.member" [routerLink]="['/members', u.member._id]">{{u.member.firstname}} {{u.member.lastname}}</a></td>
        <td>
          <label class="hoverhand"><input type="checkbox" [checked]="u.enabled" (change)="toggleEnabled(u)"> {{u.enabled ? 'Enabled' : 'Disabled'}}</label>
        </td>
        <td>{{u.lastLogin | date:'yyyy-MM-dd HH:mm'}}</td>
        <td>
          <button class="btn btn-xs btn-default" (click)="editUser(u)" title="Edit"><i class="fa fa-pencil"></i></button>
          <button class="btn btn-xs btn-danger" (click)="removeUser(u)" title="Delete"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
    </tbody>
  </table>
  <app-user-add-modal [visible]="showAddModal" [membersList]="membersList" (saved)="onAddSaved($event)" (cancelled)="onAddCancelled()"></app-user-add-modal>
  <app-user-edit-modal [user]="editingUser" [visible]="showEditModal" [membersList]="membersList" (saved)="onEditSaved($event)" (cancelled)="onEditCancelled()"></app-user-edit-modal>
</div>
  `
})
export class UsersComponent implements OnInit {
  usersList: any[] = [];
  membersList: any[] = [];
  searchQuery = '';
  roleFilter = 'All';
  rolesList = ['All', 'admin', 'captain', 'user'];
  sortBy = 'username';
  sortReverse = false;
  showAddModal = false;
  showEditModal = false;
  editingUser: any = null;
  user: any;

  filteredAndSortedUsers: any[] = [];

  constructor(
    private usersService: UsersService,
    private membersService: MembersService,
    private authStateService: AuthStateService
  ) {}

  async ngOnInit(): Promise<void> {
    this.user = this.authStateService.currentUser;
    try {
      this.usersList = await this.usersService.getUsers();
      this.updateFilteredUsers();
    } catch (err) {
      console.error('Error loading users:', err);
    }
    try {
      const members = await this.membersService.getMembersWithCacheSupport({});
      this.membersList = members.sort((a: any, b: any) => {
        const lastCmp = (a.lastname || '').localeCompare(b.lastname || '');
        if (lastCmp !== 0) return lastCmp;
        return (a.firstname || '').localeCompare(b.firstname || '');
      });
    } catch (err) {
      console.error('Error loading members:', err);
    }
  }

  updateFilteredUsers(): void {
    let filtered = [...this.usersList];

    // Filter by role
    if (this.roleFilter && this.roleFilter !== 'All') {
      filtered = filtered.filter(u => u.role === this.roleFilter);
    }

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(u => {
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const memberName = u.member
          ? ((u.member.firstname || '') + ' ' + (u.member.lastname || '')).toLowerCase()
          : '';
        const enabledStr = u.enabled ? 'enabled' : 'disabled';
        return username.includes(query) ||
               email.includes(query) ||
               memberName.includes(query) ||
               enabledStr.includes(query);
      });
    }

    // Sort
    const field = this.sortBy;
    const reverse = this.sortReverse;
    filtered.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (typeof valA === 'boolean') valA = valA ? 1 : 0;
      if (typeof valB === 'boolean') valB = valB ? 1 : 0;

      if (valA == null) valA = '';
      if (valB == null) valB = '';

      let cmp = 0;
      if (valA < valB) cmp = -1;
      else if (valA > valB) cmp = 1;

      return reverse ? -cmp : cmp;
    });

    this.filteredAndSortedUsers = filtered;
  }

  setSortBy(field: string): void {
    if (this.sortBy === field) {
      this.sortReverse = !this.sortReverse;
    } else {
      this.sortBy = field;
      this.sortReverse = false;
    }
    this.updateFilteredUsers();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'fa-sort';
    return this.sortReverse ? 'fa-sort-desc' : 'fa-sort-asc';
  }

  addUser(): void {
    this.showAddModal = true;
  }

  editUser(user: any): void {
    this.editingUser = user;
    this.showEditModal = true;
  }

  async onAddSaved(data: any): Promise<void> {
    try {
      await this.usersService.createUser(data);
      this.usersList = await this.usersService.getUsers();
      this.updateFilteredUsers();
      this.showAddModal = false;
    } catch (err) {
      console.error('Error creating user:', err);
    }
  }

  async onEditSaved(data: any): Promise<void> {
    try {
      await this.usersService.editUser(data._id, data);
      this.usersList = await this.usersService.getUsers();
      this.updateFilteredUsers();
      this.showEditModal = false;
    } catch (err) {
      console.error('Error editing user:', err);
    }
  }

  onAddCancelled(): void {
    this.showAddModal = false;
  }

  onEditCancelled(): void {
    this.showEditModal = false;
  }

  async toggleEnabled(user: any): Promise<void> {
    try {
      if (!user.enabled) {
        // Currently disabled, enabling
        const notifyUser = window.confirm('Notify user that their account has been enabled?');
        await this.usersService.editUser(user._id, { enabled: true, notifyUser });
      } else {
        // Currently enabled, disabling
        await this.usersService.editUser(user._id, { enabled: false });
      }
      user.enabled = !user.enabled;
      this.updateFilteredUsers();
    } catch (err) {
      console.error('Error toggling user enabled status:', err);
    }
  }

  async removeUser(user: any): Promise<void> {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    try {
      await this.usersService.deleteUser(user._id);
      const index = this.usersList.indexOf(user);
      if (index > -1) {
        this.usersList.splice(index, 1);
      }
      this.updateFilteredUsers();
    } catch (err) {
      console.error('Error removing user:', err);
    }
  }
}
