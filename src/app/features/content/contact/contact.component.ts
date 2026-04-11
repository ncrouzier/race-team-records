import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="jumbotron">
  <div class="col-lg-12 col-md-12 col-sm-12">
    <div class="row" style="padding-left:15px;padding-bottom:15px;">
      Any comments, question or request? Please leave a message!
    </div>
    <div class="alert alert-danger" *ngIf="error">
      <button class="close" data-dismiss="alert">x</button>
      <strong>Error!</strong> An error occured while trying to send message.
    </div>
    <div class="alert alert-success" *ngIf="success">
      <button class="close" data-dismiss="alert">x</button>
      <strong>Success! </strong> Your message was successfully sent.
    </div>
    <form role="form" #contactForm="ngForm">
      <div class="row">
        <div class="col-sm-6 form-group" [ngClass]="{error: nameField.invalid && nameField.touched}">
          <label>Full Name</label>
          <input class="form-control" type="text" name="name" [(ngModel)]="formData.name" required
            placeholder="Your name" #nameField="ngModel">
          <span class="help-block" *ngIf="nameField.errors?.['required'] && nameField.touched">Required</span>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 form-group" [ngClass]="{error: emailField.invalid && emailField.touched}">
          <label>Email</label>
          <input class="form-control" type="email" name="email" [(ngModel)]="formData.email" required
            placeholder="Your email address" #emailField="ngModel">
          <span class="help-block" *ngIf="emailField.errors?.['required'] && emailField.touched">Required</span>
          <span class="help-block" *ngIf="emailField.errors?.['email'] && emailField.touched">Invalid email address</span>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-10 form-group" [ngClass]="{error: messageField.invalid && messageField.touched}">
          <label>Message</label>
          <textarea class="form-control" rows="6" name="message" [(ngModel)]="formData.body" required
            placeholder="Your messsage" #messageField="ngModel"></textarea>
          <span class="help-block" *ngIf="messageField.errors?.['required'] && messageField.touched">Required</span>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" (click)="send()" [disabled]="contactForm.invalid">Send</button>
    </form>
  </div>
</div>
  `
})
export class ContactComponent {
  formData: any = {};
  success = false;
  error = false;

  constructor(private http: HttpClient) {}

  send(): void {
    this.http.post('/sendEmail', {
      name: this.formData.name,
      from: this.formData.email,
      body: this.formData.email + '  ' + this.formData.body,
      subject: 'MCRRC race team contact'
    }).subscribe({
      next: () => { this.success = true; },
      error: () => { this.error = true; }
    });
  }
}
