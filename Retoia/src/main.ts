import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes'; // 👈 agrega esta línea

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)] // 👈 agrega esto
}).catch(err => console.error(err));
