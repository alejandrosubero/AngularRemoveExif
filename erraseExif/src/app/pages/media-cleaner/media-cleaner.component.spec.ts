import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaCleanerComponent } from './media-cleaner.component';

describe('MediaCleanerComponent', () => {
  let component: MediaCleanerComponent;
  let fixture: ComponentFixture<MediaCleanerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaCleanerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MediaCleanerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
