import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideNgxWebstorage, withLocalStorage, withNgxWebstorageConfig } from 'ngx-webstorage';
import { AppComponent } from './app/app.component';
import { routes } from './app/app-routing.module';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideNgxWebstorage(
      withLocalStorage(),
      withNgxWebstorageConfig({ prefix: 'mcrrcApp', separator: '.', caseSensitive: true })
    )
  ]
}).catch(err => console.error('Angular bootstrap error:', err));
